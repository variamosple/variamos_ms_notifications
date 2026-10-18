import type { MigrationInterface, QueryRunner } from "typeorm";
import { qualifiedName } from "./qualifiedName.js";

// The tables as production holds them (schema read on 2026-10-18), with
// IF NOT EXISTS so an existing database is left untouched (T-07)
export class Baseline1792281600000 implements MigrationInterface {
  public readonly name = "Baseline1792281600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = (name: string) => qualifiedName(queryRunner, name);
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS ${table("notification_templates")} ("key" character varying(100) NOT NULL, "title_template" text NOT NULL, "body_template" text NOT NULL, "created_at" timestamp with time zone NOT NULL DEFAULT now(), CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("key"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS ${table("notifications")} ("id" uuid NOT NULL, "recipient_id" character varying(100) NOT NULL, "actor_id" character varying(100), "template_key" character varying(100) NOT NULL, "variables" jsonb NOT NULL DEFAULT '{}', "metadata" jsonb NOT NULL DEFAULT '{}', "is_read" boolean NOT NULL DEFAULT false, "read_at" timestamp with time zone, "created_at" timestamp with time zone NOT NULL DEFAULT now(), "deleted_at" timestamp with time zone, CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS ${table("user_preferences")} ("user_id" character varying(100) NOT NULL, "email_enabled" boolean NOT NULL DEFAULT true, "in_app_enabled" boolean NOT NULL DEFAULT true, "muted_event_types" text[] NOT NULL DEFAULT '{}', CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_notifications_recipient" ON ${table("notifications")} ("recipient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_notifications_template_key" ON ${table("notifications")} ("template_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_notifications_is_read" ON ${table("notifications")} ("is_read") WHERE (is_read = false)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_notifications_deleted_at" ON ${table("notifications")} ("deleted_at") WHERE (deleted_at IS NULL)`,
    );
  }

  public async down(): Promise<void> {
    // Reverting would drop the tables and every notification they hold
    throw new Error("The baseline migration cannot be reverted.");
  }
}
