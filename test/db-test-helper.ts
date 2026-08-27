import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { DataSource } from "typeorm";
import { NotificationEntity } from "../src/Infrastructure/Persistence/TypeORM/Entities/NotificationEntity.js";
import { NotificationTemplateEntity } from "../src/Infrastructure/Persistence/TypeORM/Entities/NotificationTemplateEntity.js";
import { UserPreferencesEntity } from "../src/Infrastructure/Persistence/TypeORM/Entities/UserPreferencesEntity.js";

export class DbTestHelper {
  private container!: StartedPostgreSqlContainer;
  private dataSource!: DataSource;

  public async start(): Promise<DataSource> {
    // Démarrage d'un conteneur Postgres officiel léger (v16 alpine)
    this.container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("variamos_notifications_test")
      .withUsername("test_user")
      .withPassword("test_password")
      .start();

    // Initialisation du DataSource TypeORM ciblant le conteneur Docker
    this.dataSource = new DataSource({
      type: "postgres",
      host: this.container.getHost(),
      port: this.container.getPort(),
      username: this.container.getUsername(),
      password: this.container.getPassword(),
      database: this.container.getDatabase(),
      entities: [NotificationEntity, NotificationTemplateEntity, UserPreferencesEntity],
      synchronize: true, // Crée les tables à partir des entités automatiquement
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
    // Nettoyer les tables entre chaque test pour isoler les jeux de données
    const entities = this.dataSource.entityMetadatas;
    for (const entity of entities) {
      const repository = this.dataSource.getRepository(entity.name);
      await repository.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE;`);
    }
  }
}
