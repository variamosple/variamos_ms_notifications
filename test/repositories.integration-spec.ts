import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { PostgresQueryRunner } from "typeorm/driver/postgres/PostgresQueryRunner.js";
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

    it("finds the preferences of several users at once, those saved only", async () => {
      await preferencesRepo.save(new UserPreferences("user-1", true, false, []));
      await preferencesRepo.save(new UserPreferences("user-2", true, true, ["e"]));
      await preferencesRepo.save(new UserPreferences("user-3", true, true, []));

      const found = await preferencesRepo.findByUserIds(["user-2", "user-1", "absent"]);

      expect(found.map((p) => p.userId).sort()).toEqual(["user-1", "user-2"]);
      expect(await preferencesRepo.findByUserIds([])).toEqual([]);
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

      const saved = await notificationRepo.saveMany([notif2]);
      const found2 = await notificationRepo.findById("bebfbd90-1234-5678-9012-36689f94b8cf");
      expect(found2).toEqual(saved[0]);
    });

    it("saves a batch in one INSERT, all or none (EV-101, OPT-04)", async () => {
      const notifAt = (id: string) =>
        new Notification(id, "user-1", null, "key-1", { n: [1, { a: null }] }, {}, false, null, new Date("2026-10-25T10:00:00Z"));
      const existing = notifAt("11111111-1234-4678-9012-36689f94b8cf");
      await notificationRepo.saveMany([existing]);

      // A batch holding a notification already saved fails as a whole
      await expect(
        notificationRepo.saveMany([
          notifAt("22222222-1234-4678-9012-36689f94b8cf"),
          existing,
        ]),
      ).rejects.toThrow();
      expect(await notificationRepo.findById("22222222-1234-4678-9012-36689f94b8cf")).toBeNull();

      const query = vi.spyOn(PostgresQueryRunner.prototype, "query");
      let queries: string[];
      try {
        await notificationRepo.saveMany(
          Array.from({ length: 50 }, (_, i) =>
            notifAt(`33333333-1234-4678-9012-${String(i).padStart(12, "0")}`),
          ),
        );
        queries = query.mock.calls.map(([sql]) => sql);
      } finally {
        query.mockRestore();
      }
      expect(queries.filter((q) => !/^(START|COMMIT)/.test(q))).toEqual([
        expect.stringMatching(/^INSERT INTO/),
      ]);
      expect((await notificationRepo.findByRecipient("user-1", 1, 100, "inbox")).length).toBe(51);
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

    it("saves the trash date of a notification moved to the trash", async () => {
      const notif = new Notification(
        "60000000-1234-5678-9012-36689f94b8cf",
        "user-1",
        null,
        "key-1",
        {},
        {},
        false,
        null,
        new Date(),
      );

      await notificationRepo.save(notif);

      const foundBefore = await notificationRepo.findById("60000000-1234-5678-9012-36689f94b8cf");
      expect(foundBefore!.deletedAt).toBeNull();

      foundBefore!.moveToTrash();
      await notificationRepo.save(foundBefore!);

      const foundAfter = await notificationRepo.findById("60000000-1234-5678-9012-36689f94b8cf");
      expect(foundAfter!.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe("NotificationRepository scope (CA-NT-01)", () => {
    const unread = (id: string, recipientId: string) =>
      new Notification(id, recipientId, null, "key-1", {}, {}, false, null, new Date());

    beforeEach(async () => {
      await notificationRepo.saveMany([
        unread("a1000000-1234-5678-9012-36689f94b8cf", "user-a"),
        unread("b1000000-1234-5678-9012-36689f94b8cf", "user-b"),
      ]);
    });

    it("marks only the given recipient's notifications as read", async () => {
      await notificationRepo.markAllAsRead("user-a");

      expect(await notificationRepo.countUnread("user-a")).toBe(0);
      expect(await notificationRepo.countUnread("user-b")).toBe(1);
    });

    it.each(["", undefined])(
      "refuses to mark all as read without recipient (%j) and touches no row",
      async (recipientId) => {
        await expect(
          notificationRepo.markAllAsRead(recipientId as unknown as string),
        ).rejects.toThrow("A recipient is required.");

        expect(await notificationRepo.countUnread("user-a")).toBe(1);
        expect(await notificationRepo.countUnread("user-b")).toBe(1);
      },
    );

    it("refuses to list or empty the trash without recipient", async () => {
      await expect(
        notificationRepo.findByRecipient("", 1, 10, "inbox"),
      ).rejects.toThrow("A recipient is required.");
      await expect(notificationRepo.emptyTrash("")).rejects.toThrow(
        "A recipient is required.",
      );
    });
  });

  describe("NotificationRepository pagination (TST-NOTIF-13)", () => {
    it("pages 25 notifications by 10, newest first", async () => {
      const base = new Date("2026-10-01T00:00:00Z").getTime();
      await notificationRepo.saveMany(
        Array.from({ length: 25 }, (_, i) =>
          new Notification(
            `${String(i).padStart(8, "0")}-1234-4678-9012-36689f94b8cf`,
            "user-p",
            null,
            "key-1",
            {},
            {},
            false,
            null,
            new Date(base + i * 60_000),
          ),
        ),
      );

      const pages = await Promise.all(
        [1, 2, 3].map((page) =>
          notificationRepo.findByRecipient("user-p", page, 10, "inbox"),
        ),
      );

      expect(pages.map((p) => p.length)).toEqual([10, 10, 5]);
      const times = pages.flat().map((n) => n.createdAt.getTime());
      expect(times).toEqual([...times].sort((a, b) => b - a));
      expect(new Set(pages.flat().map((n) => n.id)).size).toBe(25);
    });
  });
});
