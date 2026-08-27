import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationTemplate } from "../../../../Domain/Entities/NotificationTemplate.js";
import { INotificationTemplateRepository } from "../../../../Domain/Repositories/INotificationTemplateRepository.js";
import { NotificationTemplateEntity } from "../Entities/NotificationTemplateEntity.js";
import * as NotificationTemplateMapper from "../Mappers/NotificationTemplateMapper.js";

@Injectable()
export class NotificationTemplateTypeORMRepository
  implements INotificationTemplateRepository
{
  constructor(
    @InjectRepository(NotificationTemplateEntity)
    private readonly repository: Repository<NotificationTemplateEntity>,
  ) {}

  public async findByKey(key: string): Promise<NotificationTemplate | null> {
    const entity = await this.repository.findOne({ where: { key } });
    if (!entity) {
      return null;
    }
    return NotificationTemplateMapper.toDomain(entity);
  }

  public async save(
    template: NotificationTemplate,
  ): Promise<NotificationTemplate> {
    const entity = NotificationTemplateMapper.toPersistence(template);
    const savedEntity = await this.repository.save(entity);
    return NotificationTemplateMapper.toDomain(savedEntity);
  }
}
