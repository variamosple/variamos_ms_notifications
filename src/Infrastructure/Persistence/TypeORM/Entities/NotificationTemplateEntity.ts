import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "notification_templates" })
export class NotificationTemplateEntity {
  @PrimaryColumn({ type: "varchar", length: 100 })
  key!: string;

  @Column({ name: "title_template", type: "text" })
  titleTemplate!: string;

  @Column({ name: "body_template", type: "text" })
  bodyTemplate!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamp with time zone" })
  createdAt!: Date;
}
