import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { DataSource } from "typeorm";
import { NotificationEntity } from "../src/Infrastructure/Persistence/TypeORM/Entities/NotificationEntity.js";
import { NotificationTemplateEntity } from "../src/Infrastructure/Persistence/TypeORM/Entities/NotificationTemplateEntity.js";
import { UserPreferencesEntity } from "../src/Infrastructure/Persistence/TypeORM/Entities/UserPreferencesEntity.js";
import {
  NOTIFICATIONS_MIGRATIONS,
  NOTIFICATIONS_MIGRATIONS_TABLE,
} from "../src/Infrastructure/Persistence/TypeORM/Migrations/index.js";

export class DbTestHelper {
  private container!: StartedPostgreSqlContainer;
  private dataSource!: DataSource;

  public async start(): Promise<DataSource> {
    // Start a lightweight official Postgres container (v16-alpine)
    this.container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("variamos_notifications_test")
      .withUsername("test_user")
      .withPassword("test_password")
      .start();

    // Create a temporary connection to create the 'variamos' schema in the fresh test container
    const setupDataSource = new DataSource({
      type: "postgres",
      host: this.container.getHost(),
      port: this.container.getPort(),
      username: this.container.getUsername(),
      password: this.container.getPassword(),
      database: this.container.getDatabase(),
    });
    await setupDataSource.initialize();
    await setupDataSource.query("CREATE SCHEMA IF NOT EXISTS variamos;");
    await setupDataSource.destroy();

    // Initialize TypeORM DataSource targeting the 'variamos' schema
    this.dataSource = new DataSource({
      type: "postgres",
      host: this.container.getHost(),
      port: this.container.getPort(),
      username: this.container.getUsername(),
      password: this.container.getPassword(),
      database: this.container.getDatabase(),
      schema: "variamos",
      entities: [NotificationEntity, NotificationTemplateEntity, UserPreferencesEntity],
      // Same path as production: the tables come from the migrations
      migrations: NOTIFICATIONS_MIGRATIONS,
      migrationsTableName: NOTIFICATIONS_MIGRATIONS_TABLE,
      migrationsRun: true,
    });

    await this.dataSource.initialize();
    return this.dataSource;
  }

  public async stop(): Promise<void> {
    if (this.dataSource?.isInitialized) {
      await this.dataSource.destroy();
    }
    if (this.container) {
      await this.container.stop();
    }
  }

  public async clear(): Promise<void> {
    if (!this.dataSource?.isInitialized) {
      return;
    }
    // Truncate tables between tests to isolate datasets
    const entities = this.dataSource.entityMetadatas;
    // The migrations table keeps its rows
    for (const entity of entities) {
      await this.dataSource.query(`TRUNCATE TABLE "variamos"."${entity.tableName}" CASCADE;`);
    }
  }
}
