import type { MigrationInterface, QueryRunner } from "typeorm";
import { qualifiedName } from "./qualifiedName.js";

export const INBOX_INDEX = "idx_notifications_inbox";

// The inbox reads a user's notifications not in the trash, newest first,
// one page at a time (EV-101). This index gives them in that order, so that
// PostgreSQL no longer sorts all of a user's notifications for each page;
// the trash, rarely opened, keeps the index on the recipient.
export class InboxIndex1793577600000 implements MigrationInterface {
  public readonly name = "InboxIndex1793577600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "${INBOX_INDEX}" ON ${qualifiedName(queryRunner, "notifications")} ("recipient_id", "created_at") WHERE (deleted_at IS NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schema = queryRunner.connection.driver.schema ?? "public";
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."${INBOX_INDEX}"`,
    );
  }
}
