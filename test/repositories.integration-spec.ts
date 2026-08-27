import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import { DbTestHelper } from "./db-test-helper.js";
import { NotificationTypeORMRepository } from "../src/Infrastructure/Persistence/TypeORM/Repositories/NotificationTypeORMRepository.js";
import { NotificationTemplateTypeORMRepository } from "../src/Infrastructure/Persistence/TypeORM/Repositories/NotificationTemplateTypeORMRepository.js";
import { UserPreferencesTypeORMRepository } from "../src/Infrastructure/Persistence/TypeORM/Repositories/UserPreferencesTypeORMRepository.js";
import { NotificationEntity } from "../src/Infrastructure/Persistence/TypeORM/Entities/NotificationEntity.js";
import { NotificationTemplateEntity } from "../src/Infrastructure/Persistence/TypeORM/Entities/NotificationTemplateEntity.js";
import { UserPreferencesEntity } from "../src/Infrastructure/Persistence/TypeORM/Entities/UserPreferencesEntity.js";
import { Notification } from "../src/Domain/Entities/Notification.js";
import { NotificationTemplate } from "../src/Domain/Entities/NotificationTemplate.js";
import { UserPreferences } from "../src/Domain/Entities/UserPreferences.js";

describe("Repositories (Integration)", () => {
  let dbHelper: DbTestHelper;
  let dataSource: DataSource;
  let notificationRepo: NotificationTypeORMRepository;
  let templateRepo: NotificationTemplateTypeORMRepository;
  let preferencesRepo: UserPreferencesTypeORMRepository;

  beforeAll(async () => {
    dbHelper = new DbTestHelper();
    dataSource = await dbHelper.start();

    notificationRepo = new NotificationTypeORMRepository(
      dataSource.getRepository(NotificationEntity),
    );
    templateRepo = new NotificationTemplateTypeORMRepository(
      dataSource.getRepository(NotificationTemplateEntity),
    );
    preferencesRepo = new UserPreferencesTypeORMRepository(
      dataSource.getRepository(UserPreferencesEntity),
    );
  }, 60000); // 60s timeout for pulling the postgres docker image and starting it

  afterAll(async () => {
    await dbHelper.stop();
  });

  beforeEach(async () => {
    await dbHelper.clear();
  });

  describe("UserPreferencesRepository", () => {
    it("should save and find user preferences", async () => {
      const prefs = new UserPreferences("user-1", true, false, ["event-1"]);
      await preferencesRepo.save(prefs);

      const found = await preferencesRepo.findByUserId("user-1");
      expect(found).not.toBeNull();
      expect(found!.userId).toBe("user-1");
      expect(found!.emailEnabled).toBe(true);
      expect(found!.inAppEnabled).toBe(false);
      expect(found!.mutedEventTypes).toEqual(["event-1"]);
    });

    it("should return null if user preferences do not exist", async () => {
      const found = await preferencesRepo.findByUserId("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("NotificationTemplateRepository", () => {
    it("should save and find template by key", async () => {
      const template = new NotificationTemplate("key-1", "Title", "Body", new Date());
      await templateRepo.save(template);

      const found = await templateRepo.findByKey("key-1");
      expect(found).not.toBeNull();
      expect(found!.key).toBe("key-1");
      expect(found!.titleTemplate).toBe("Title");
      expect(found!.bodyTemplate).toBe("Body");
    });

    it("should return null if template key does not exist", async () => {
      const found = await templateRepo.findByKey("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("NotificationRepository", () => {
    it("should save, find by id, and save many notifications", async () => {
      const notif = new Notification(
        "42a7b62e-1234-5678-9012-36689f94b8cf",
        "user-1",
        "actor-1",
        "key-1",
        { name: "Nathan" },
        { tags: ["test"] },
        false,
        null,
        new Date(),
      );

      await notificationRepo.save(notif);

      const found = await notificationRepo.findById("42a7b62e-1234-5678-9012-36689f94b8cf");
      expect(found).not.toBeNull();
      expect(found!.recipientId).toBe("user-1");
      expect(found!.variables).toEqual({ name: "Nathan" });
      expect(found!.metadata).toEqual({ tags: ["test"] });

      const notif2 = new Notification(
        "bebfbd90-1234-5678-9012-36689f94b8cf",
        "user-1",
        null,
        "key-1",
        {},
        {},
        false,
        null,
        new Date(),
      );

      await notificationRepo.saveMany([notif2]);
      const found2 = await notificationRepo.findById("bebfbd90-1234-5678-9012-36689f94b8cf");
      expect(found2).not.toBeNull();
    });

    it("should support inbox/trash folders and pagination", async () => {
      const notifInbox = new Notification(
        "10000000-1234-5678-9012-36689f94b8cf",
        "user-1",
        null,
        "key-1",
        {},
        {},
        false,
        null,
        new Date("2026-08-27T10:00:00Z"),
      );

      const notifTrash = new Notification(
        "20000000-1234-5678-9012-36689f94b8cf",
        "user-1",
        null,
        "key-1",
        {},
        {},
        true,
        new Date(),
        new Date("2026-08-27T11:00:00Z"),
        new Date("2026-08-27T12:00:00Z"), // deletedAt
      );

      await notificationRepo.saveMany([notifInbox, notifTrash]);

      // Inbox check (deletedAt is null)
      const inboxList = await notificationRepo.findByRecipient("user-1", 1, 10, "inbox");
      expect(inboxList).toHaveLength(1);
      expect(inboxList[0].id).toBe("10000000-1234-5678-9012-36689f94b8cf");

      // Trash check (deletedAt is not null)
      const trashList = await notificationRepo.findByRecipient("user-1", 1, 10, "trash");
      expect(trashList).toHaveLength(1);
      expect(trashList[0].id).toBe("20000000-1234-5678-9012-36689f94b8cf");
    });

    it("should count unread and mark all as read for a recipient", async () => {
      const notif1 = new Notification(
        "30000000-1234-5678-9012-36689f94b8cf",
        "user-1",
        null,
        "key-1",
        {},
        {},
        false,
        null,
        new Date(),
      );

      const notif2 = new Notification(
        "40000000-1234-5678-9012-36689f94b8cf",
        "user-1",
        null,
        "key-1",
        {},
        {},
        false,
        null,
        new Date(),
      );

      await notificationRepo.saveMany([notif1, notif2]);

      const countBefore = await notificationRepo.countUnread("user-1");
      expect(countBefore).toBe(2);

      await notificationRepo.markAllAsRead("user-1");

      const countAfter = await notificationRepo.countUnread("user-1");
      expect(countAfter).toBe(0);
    });

    it("should permanently empty notifications in trash", async () => {
      const notifTrash = new Notification(
        "50000000-1234-5678-9012-36689f94b8cf",
        "user-1",
        null,
        "key-1",
        {},
        {},
        false,
        null,
        new Date(),
        new Date(), // deletedAt
      );

      await notificationRepo.save(notifTrash);

      const trashBefore = await notificationRepo.findByRecipient("user-1", 1, 10, "trash");
      expect(trashBefore).toHaveLength(1);

      await notificationRepo.emptyTrash("user-1");

      const trashAfter = await notificationRepo.findByRecipient("user-1", 1, 10, "trash");
      expect(trashAfter).toHaveLength(0);
    });
  });
});
