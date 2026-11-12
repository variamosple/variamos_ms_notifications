import type { MigrationInterface, QueryRunner } from "typeorm";
import { qualifiedName } from "./qualifiedName.js";

/**
 * The templates the platform sends (EV-99, CA-NT-11). A send names one of
 * them; a database without it refused the send, so a new one (tests, local)
 * needed rows added by hand. The interface renders the title and the body
 * (variamos-components): here a template states that the key is accepted,
 * and its texts mirror those of the interface.
 */
export const PLATFORM_TEMPLATES = [
  { key: "admin_alert", title: "{{title}}", body: "{{body}}" },
  {
    key: "review_assigned",
    title: "Language Review Assigned",
    body: "You have been assigned to review the translation for {{languageName}}.",
  },
  {
    key: "project_created",
    title: "Project Created",
    body: "The project '{{projectName}}' has been created successfully.",
  },
  {
    key: "test_template",
    title: "Notification Test",
    body: "Hello {{name}}, this is a real-time notification test.",
  },
] as const;

// Adds the missing templates only: the rows already there, made by hand in
// production, are kept as they are
export class NotificationTemplates1794268800001 implements MigrationInterface {
  public readonly name = "NotificationTemplates1794268800001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const template of PLATFORM_TEMPLATES) {
      await queryRunner.query(
        `INSERT INTO ${qualifiedName(queryRunner, "notification_templates")} ("key", "title_template", "body_template") VALUES ($1, $2, $3) ON CONFLICT ("key") DO NOTHING`,
        [template.key, template.title, template.body],
      );
    }
  }

  public async down(): Promise<void> {
    // Nothing is removed: the same rows may have been there before this
    // migration, and a send naming them would then be refused
  }
}
