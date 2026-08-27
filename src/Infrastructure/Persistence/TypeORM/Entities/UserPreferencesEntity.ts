import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "user_preferences" })
export class UserPreferencesEntity {
  @PrimaryColumn({ name: "user_id", type: "varchar", length: 100 })
  userId!: string;

  @Column({ name: "email_enabled", type: "boolean", default: true })
  emailEnabled!: boolean;

  @Column({ name: "in_app_enabled", type: "boolean", default: true })
  inAppEnabled!: boolean;

  @Column({
    name: "muted_event_types",
    type: "text",
    array: true,
    default: "{}",
  })
  mutedEventTypes!: string[];
}
