import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { AuditAction } from '../../common/enums/audit-action.enum';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async create(createAuditLogDto: CreateAuditLogDto): Promise<AuditLog> {
    const { userId, ...auditData } = createAuditLogDto;

    const auditLog = this.auditLogRepository.create({
      ...auditData,
      user: userId ? ({ id: userId } as any) : null,
    });

    return this.auditLogRepository.save(auditLog);
  }

  async log(
    action: AuditAction,
    entityType: string,
    entityId: string,
    userId: string,
    options?: {
      oldValues?: Record<string, any>;
      newValues?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
      description?: string;
    },
  ): Promise<AuditLog> {
    return this.create({
      action,
      entityType,
      entityId,
      userId,
      ...options,
    });
  }

  async findAll(filters?: {
    page?: number;
    limit?: number;
    userId?: string;
    action?: AuditAction;
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    data: AuditLog[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<AuditLog> = {};

    if (filters?.userId) {
      where.user = { id: filters.userId } as any;
    }

    if (filters?.action) {
      where.action = filters.action;
    }

    if (filters?.entityType) {
      where.entityType = filters.entityType;
    }

    if (filters?.entityId) {
      where.entityId = filters.entityId;
    }

    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user');

    if (Object.keys(where).length > 0) {
      queryBuilder.where(where);
    }

    if (filters?.startDate) {
      queryBuilder.andWhere('audit.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters?.endDate) {
      queryBuilder.andWhere('audit.createdAt <= :endDate', {
        endDate: filters.endDate,
      });
    }

    queryBuilder.orderBy('audit.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByUser(userId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async findByEntity(
    entityType: string,
    entityId: string,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByAction(action: AuditAction): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { action },
      order: { createdAt: 'DESC' },
    });
  }

  async getStats(): Promise<{
    total: number;
    byAction: Record<string, number>;
    byEntityType: Record<string, number>;
    recentActivity: AuditLog[];
  }> {
    const [total, logs] = await Promise.all([
      this.auditLogRepository.count(),
      this.auditLogRepository.find({
        take: 100,
        order: { createdAt: 'DESC' },
      }),
    ]);

    const byAction: Record<string, number> = {};
    const byEntityType: Record<string, number> = {};

    logs.forEach((log) => {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      byEntityType[log.entityType] = (byEntityType[log.entityType] || 0) + 1;
    });

    return {
      total,
      byAction,
      byEntityType,
      recentActivity: logs.slice(0, 10),
    };
  }
}
