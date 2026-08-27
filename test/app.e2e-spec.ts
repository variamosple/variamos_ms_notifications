import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "./../src/app.module.js";
import { DbTestHelper } from "./db-test-helper.js";

interface PostgresOptions {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
}

describe("AppModule (e2e)", () => {
  let app: INestApplication;
  let dbHelper: DbTestHelper;

  beforeAll(async () => {
    dbHelper = new DbTestHelper();
    const dataSource = await dbHelper.start();
    const options = dataSource.options as PostgresOptions;

    // Inject database connection details dynamically into process.env
    process.env.DATABASE_HOST = options.host;
    process.env.DATABASE_PORT = String(options.port);
    process.env.DATABASE_USERNAME = options.username;
    process.env.DATABASE_PASSWORD = options.password;
    process.env.DATABASE_NAME = options.database;
  }, 60000);

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it("should initialize the application successfully", () => {
    expect(app).toBeDefined();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  afterAll(async () => {
    await dbHelper.stop();
  });
});
