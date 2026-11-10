import type { MigrationInterface, QueryRunner } from "typeorm";
import { qualifiedName } from "./qualifiedName.js";

export const EVENT_RECIPIENT_INDEX = "idx_notifications_event_recipient";

// The key of a send, chosen by its sender (EV-99, CA-NT-05): a send repeated
// with the same key, after a timeout or a failed batch, gives nothing twice
// to a recipient. The index is unique only for keyed rows; the rows saved
// before it, without key, stay as they are. The column is new and empty, so
// neither statement rewrites the table.
export class NotificationEventId1794268800000 implements MigrationInterface {
  public readonly name = "NotificationEventId1794268800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const notifications = qualifiedName(queryRunner, "notifications");
    await queryRunner.query(
      `ALTER TABLE ${notifications} ADD COLUMN IF NOT EXISTS "event_id" character varying(128)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "${EVENT_RECIPIENT_INDEX}" ON ${notifications} ("event_id", "recipient_id") WHERE (event_id IS NOT NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schema = queryRunner.connection.driver.schema ?? "public";
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."${EVENT_RECIPIENT_INDEX}"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${qualifiedName(queryRunner, "notifications")} DROP COLUMN IF EXISTS "event_id"`,
    );
  }
}
