import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from "typeorm";
import { JsonValue } from "../../../../Domain/Entities/JsonValue.js";

@Entity({ name: "notifications" })
// Names and indexes as production holds them: the schema builder must find
// nothing to change (test/migrations.integration-spec.ts)
@Index("idx_notifications_recipient", ["recipientId"])
@Index("idx_notifications_template_key", ["templateKey"])
@Index("idx_notifications_is_read", ["isRead"], { where: "(is_read = false)" })
@Index("idx_notifications_deleted_at", ["deletedAt"], {
  where: "(deleted_at IS NULL)",
})
export class NotificationEntity {
  @PrimaryColumn({
    type: "uuid",
    primaryKeyConstraintName: "notifications_pkey",
  })
  id!: string;

  @Column({ name: "recipient_id", type: "varchar", length: 100 })
  recipientId!: string;

  @Column({ name: "actor_id", type: "varchar", length: 100, nullable: true })
  actorId!: string | null;

  @Column({ name: "template_key", type: "varchar", length: 100 })
  templateKey!: string;

  @Column({ type: "jsonb", default: {} })
  variables!: Record<string, JsonValue>;

  @Column({ type: "jsonb", default: {} })
  metadata!: Record<string, JsonValue>;

  @Column({ name: "is_read", type: "boolean", default: false })
  isRead!: boolean;

  @Column({
    name: "read_at",
    type: "timestamp with time zone",
    nullable: true,
  })
  readAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamp with time zone" })
  createdAt!: Date;

  @Column({
    name: "deleted_at",
    type: "timestamp with time zone",
    nullable: true,
  })
  deletedAt!: Date | null;
}
