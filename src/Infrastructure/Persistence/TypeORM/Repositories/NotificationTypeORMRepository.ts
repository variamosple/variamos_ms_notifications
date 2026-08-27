import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Not, Repository } from "typeorm";
import { Notification } from "../../../../Domain/Entities/Notification.js";
import { INotificationRepository } from "../../../../Domain/Repositories/INotificationRepository.js";
import { NotificationEntity } from "../Entities/NotificationEntity.js";
import * as NotificationMapper from "../Mappers/NotificationMapper.js";

@Injectable()
export class NotificationTypeORMRepository implements INotificationRepository {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly repository: Repository<NotificationEntity>,
  ) {}

  public async save(notification: Notification): Promise<Notification> {
    const entity = NotificationMapper.toPersistence(notification);
    const savedEntity = await this.repository.save(entity);
    return NotificationMapper.toDomain(savedEntity);
  }

  public async saveMany(
    notifications: Notification[],
  ): Promise<Notification[]> {
    const entities = notifications.map((n) =>
      NotificationMapper.toPersistence(n),
    );
    const savedEntities = await this.repository.save(entities);
    return savedEntities.map((e) => NotificationMapper.toDomain(e));
  }

  public async findById(id: string): Promise<Notification | null> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      return null;
    }
    return NotificationMapper.toDomain(entity);
  }

  public async findByRecipient(
    recipientId: string,
    page: number,
    limit: number,
    folder: "inbox" | "trash",
  ): Promise<Notification[]> {
    const entities = await this.repository.find({
      where: {
        recipientId,
        deletedAt: folder === "inbox" ? IsNull() : Not(IsNull()),
      },
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return entities.map((e) => NotificationMapper.toDomain(e));
  }

  public async countUnread(recipientId: string): Promise<number> {
    return this.repository.count({
      where: {
        recipientId,
        isRead: false,
        deletedAt: IsNull(),
      },
    });
  }

  public async markAllAsRead(recipientId: string): Promise<void> {
    await this.repository.update(
      { recipientId, isRead: false, deletedAt: IsNull() },
      { isRead: true, readAt: new Date() },
    );
  }

  public async emptyTrash(recipientId: string): Promise<void> {
    await this.repository.delete({
      recipientId,
      deletedAt: Not(IsNull()),
    });
  }
}
