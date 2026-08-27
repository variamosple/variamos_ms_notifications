import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { DataSource } from "typeorm";
import { NotificationEntity } from "../src/Infrastructure/Persistence/TypeORM/Entities/NotificationEntity.js";
import { NotificationTemplateEntity } from "../src/Infrastructure/Persistence/TypeORM/Entities/NotificationTemplateEntity.js";
import { UserPreferencesEntity } from "../src/Infrastructure/Persistence/TypeORM/Entities/UserPreferencesEntity.js";

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

    // Initialize TypeORM DataSource targeting the Docker container
    this.dataSource = new DataSource({
      type: "postgres",
      host: this.container.getHost(),
      port: this.container.getPort(),
      username: this.container.getUsername(),
      password: this.container.getPassword(),
      database: this.container.getDatabase(),
      entities: [NotificationEntity, NotificationTemplateEntity, UserPreferencesEntity],
      synchronize: true, // Automatically creates tables from entities
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
    for (const entity of entities) {
      const repository = this.dataSource.getRepository(entity.name);
      await repository.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE;`);
    }
  }
}
