import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";
import { JsonValue } from "../../../../Domain/Entities/JsonValue.js";

@Entity({ name: "notifications" })
export class NotificationEntity {
  @PrimaryColumn({ type: "uuid" })
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
