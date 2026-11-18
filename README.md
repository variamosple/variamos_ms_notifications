# VariaMos Notifications Microservice

NestJS microservice to store and dispatch notifications in real-time (REST + WebSockets) for the VariaMos platform.

---

## Overview

```mermaid
graph TD
  Client[Frontend Client] -- WebSocket Connection --> WSGateway[NotificationGateway]
  Client -- HTTP Request --> Controller[NotificationController]
  MSAdmin[Other Microservice e.g. Admin] -- HTTP POST /notifications --> Controller
  Controller -- Calls --> UseCases[Use Cases]
  UseCases -- Persists --> DB[PostgreSQL Database]
  UseCases -- Triggers Real-Time Broadcast --> WSGateway
  WSGateway -- Emits notification event --> Client
```

---

## Configuration

Set these variables in your local `.env` file:

```env
PORT=3000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=variamos_user
DATABASE_PASSWORD=variamos_password
DATABASE_NAME=variamos_notifications
DATABASE_SSL=false
NOTIFICATION_INTERNAL_TOKEN=your-shared-secret-token
```

---

## Running it with the rest of the platform

The [development kit](https://github.com/variamosple/variamos_dev_kit) runs the whole platform locally with Docker, with a sanitized copy of the production database. Clone it next to this repository, then:

```bash
npm run kit       # build this repository and start the kit with it
npm run kit:stop  # stop the kit (its database is kept)
```

The service answers on `http://localhost:8090/variamos_ms_notifications/`. The kit is looked for next to this repository, or in `KIT_DIR`. `./kit build off <service>` in the kit goes back to the published image; `./kit doctor` checks the machine.

## HTTP REST API

All routes are prefixed with `/notifications`.

### 1. Send a notification (internal call)
*   **POST** `/`
*   **Headers:** `x-internal-token: <NOTIFICATION_INTERNAL_TOKEN>`
*   **Body (JSON):**
    ```json
    {
      "recipients": {
        "userIds": ["user-uuid-1", "user-uuid-2"]
      },
      "templateKey": "review_assigned",
      "variables": { "languageName": "French" },
      "metadata": { "tag": "linguistics" },
      "actorId": "user-uuid-actor",
      "eventId": "review-1234",
      "mandatory": false
    }
    ```
*   **Recipient Targeting Logic:**
    *   **Specific Users:** Pass an array of user ids in `recipients.userIds` (at most 5,000). The service deduplicates them.
    *   **By Role:** Not supported here. `recipients.roles` must be empty: the sender resolves roles into user ids first (the admin service does it for its broadcasts).
*   **Template:** `templateKey` must name a row of `notification_templates`. The migrations add the templates of the platform (`admin_alert`, `review_assigned`, `project_created`, `test_template`) when they are missing. The title and body shown to the user are rendered by the interface (`variamos-components`), from `templateKey` and `variables`.
*   **Send key (`eventId`, optional):** an id of your choice for this send, at most 128 characters. Send the same key again after a timeout or an error: a recipient who already received it gets nothing more, the others get it. Without a key, a repeated send is saved twice.
*   **Mandatory (`mandatory`, optional, default `false`):** delivered even to a recipient who muted this template, for security alerts.
*   **Response:** `201 Created`

### Get notifications
*   **GET** `/`
*   **Query params:**
    *   `recipientId` (required): User UUID
    *   `folder` (optional): `"inbox"` (default) or `"trash"`
    *   `page` (optional): default `1`
    *   `limit` (optional): default `10`

### Mark a notification as read
*   **PATCH** `/:id/read`
*   **Response:** `200 OK`

### Mark all as read
*   **PATCH** `/read-all?recipientId=<user-uuid>`
*   **Response:** `204 No Content`

### Empty trash
*   **DELETE** `/trash?recipientId=<user-uuid>`
*   **Response:** `204 No Content`

### Get preferences
*   **GET** `/preferences?recipientId=<user-uuid>`

### Update preferences
*   **PATCH** `/preferences?recipientId=<user-uuid>`
*   **Body (JSON):**
    ```json
    {
      "emailEnabled": true,
      "inAppEnabled": false,
      "mutedEventTypes": ["project_created"]
    }
    ```

---

## WebSockets

Clients connect using Socket.io to receive real-time notifications.

*   **URL:** `ws://localhost:3000`, on the namespace `/` or `/variamos_ms_notifications` (a notification is sent once on each).
*   **Handshake:** pass the access token issued by `variamos_ms_admin` in `auth.token`. The client joins the room of the user of the token; a user id sent by the client is ignored. Without a valid token the connection is refused (the service runs in "enforce" mode, `src/Infrastructure/Auth/AccessControlMode.ts`).
    ```javascript
    import { io } from "socket.io-client";
    const socket = io("http://localhost:3000", {
      auth: { token: accessToken },
      transports: ["websocket"],
    });
    ```
*   **Event:** listen to the `"notification"` event. Its message has six fields, as in [`notification-realtime.example.json`](src/Infrastructure/WebSockets/notification-realtime.example.json); `createdAt` arrives as an ISO text.
    ```javascript
    socket.on("notification", ({ id, templateKey, variables, metadata, isRead, createdAt }) => {
      console.log("Received notification:", templateKey, variables);
    });
    ```
*   **Contract:** the same example is kept in `variamos_components` (`lib/Context/notification-realtime.example.json`). The test of `NotificationGateway.send` checks that the service emits it, and the test of the library checks that it reads it. Change both copies together.

---

## Client Microservice Integration

Add these variables to your microservice's `.env` configuration:
```env
NOTIFICATION_SERVICE_URL=http://localhost:3000
NOTIFICATION_INTERNAL_TOKEN=your-shared-secret-token
```

### TypeScript client snippet:
```typescript
import axios from "axios";

export class NotificationClient {
  private readonly url = process.env.NOTIFICATION_SERVICE_URL;
  private readonly token = process.env.NOTIFICATION_INTERNAL_TOKEN;

  public async sendNotification(payload: {
    recipients: { userIds: string[] };
    templateKey: string;
    variables?: Record<string, any>;
    metadata?: Record<string, any>;
    actorId?: string | null;
    eventId?: string;
    mandatory?: boolean;
  }): Promise<void> {
    if (!this.url || !this.token) return;

    await axios.post(`${this.url}/notifications`, payload, {
      headers: {
        "x-internal-token": this.token,
        "Content-Type": "application/json",
      },
    });
  }
}
```

---

## Local Development

### 1. Database
Configure your database credentials in `.env`.
*Hint: Run Postgres in Docker with the default credentials matching the .env above:*

```bash
docker run --name variamos-postgres -e POSTGRES_USER=variamos_user -e POSTGRES_PASSWORD=variamos_password -e POSTGRES_DB=variamos_notifications -p 5432:5432 -d postgres
docker exec variamos-postgres psql -U variamos_user -d variamos_notifications -c "CREATE SCHEMA IF NOT EXISTS variamos"
```

The tables are created by versioned migrations (`src/Infrastructure/Persistence/TypeORM/Migrations/`), applied at start-up and recorded in `notifications_migrations`. If a migration fails, the service does not start. TypeORM `synchronize` is never used: to change the schema, add a migration and list it in `Migrations/index.ts`; `test/migrations.integration-spec.ts` fails if the migrations and the entities disagree.

### 2. Run the app
```bash
npm install
npm run start:dev
```

### 3. Tests
```bash
npm run test      # Unit tests
npm run test:e2e  # Integration & E2E (uses Docker Testcontainers)
npm run lint      # Biome formatting
```
