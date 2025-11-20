import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, QueryFailedError, DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { Worker } from './entities/worker.entity';
import { WorkerProcess } from './entities/worker-process.entity';
import { SelectionProcess } from '../processes/entities/selection-process.entity';
import { Report } from '../reports/entities/report.entity';
import { User } from '../users/entities/user.entity';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { ApplyToProcessDto } from './dto/apply-to-process.dto';
import { UpdateWorkerProcessStatusDto } from './dto/update-worker-process-status.dto';
import { WorkerFilterDto } from './dto/worker-filter.dto';
import { WorkerStatus } from '../../common/enums/worker-status.enum';
import { ProcessStatus } from '../../common/enums/process-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { paginate } from '../../common/helpers/pagination.helper';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { S3Service } from '../../common/services/s3.service';
import { uploadFileAndGetPublicUrl, extractS3KeyFromUrl } from '../../common/helpers/s3.helper';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { UsersService } from '../users/users.service';

@Injectable()
export class WorkersService {
  private readonly logger = new Logger(WorkersService.name);

  constructor(
    @InjectRepository(Worker)
    private readonly workerRepository: Repository<Worker>,
    @InjectRepository(WorkerProcess)
    private readonly workerProcessRepository: Repository<WorkerProcess>,
    @InjectRepository(SelectionProcess)
    private readonly processRepository: Repository<SelectionProcess>,
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    private readonly s3Service: S3Service,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly usersService: UsersService,
  ) {}

  async create(createWorkerDto: CreateWorkerDto): Promise<Worker> {
    // Validaciones previas
    const existingWorker = await this.workerRepository.findOne({
      where: [{ rut: createWorkerDto.rut }, { email: createWorkerDto.email }],
    });

    if (existingWorker) {
      throw new BadRequestException(
        'Trabajador con este RUT o email ya existe',
      );
    }

    const existingUser = await this.userRepository.findOne({
      where: { email: createWorkerDto.email },
    });

    if (existingUser) {
      throw new BadRequestException(
        'Ya existe un usuario con este email',
      );
    }

    // Usar transacción para asegurar que se creen ambos o ninguno
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Si NO viene contraseña, generar una por defecto
      const password = createWorkerDto.password || 'Talentree2024!';
      const hashedPassword = await bcrypt.hash(password, 10);

      // Crear el usuario primero
      const user = queryRunner.manager.create(User, {
        email: createWorkerDto.email,
        password: hashedPassword,
        firstName: createWorkerDto.firstName,
        lastName: createWorkerDto.lastName,
        phone: createWorkerDto.phone,
        role: UserRole.WORKER,
        isActive: true,
        isEmailVerified: false,
      });
      const savedUser = await queryRunner.manager.save(User, user);

      // Eliminar password del DTO antes de crear el worker
      const { password: _, ...workerData } = createWorkerDto;

      // Crear el worker vinculado al usuario
      const worker = queryRunner.manager.create(Worker, {
        ...workerData,
        user: savedUser,
      });
      const savedWorker = await queryRunner.manager.save(Worker, worker);

      await queryRunner.commitTransaction();

      // Retornar el worker con sus relaciones
      return this.workerRepository.findOne({
        where: { id: savedWorker.id },
        relations: ['user'],
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al crear trabajador: ${error.message}`);
      throw new BadRequestException('Error al crear el trabajador');
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(filters?: WorkerFilterDto): Promise<PaginatedResult<Worker>> {
    const queryBuilder = this.workerRepository
      .createQueryBuilder('worker')
      .leftJoinAndSelect('worker.user', 'user')
      .leftJoinAndSelect('worker.workerProcesses', 'workerProcesses')
      .leftJoinAndSelect('workerProcesses.process', 'process');

    // Filtrar por empresa si se proporciona companyId
    if (filters?.companyId) {
      queryBuilder.andWhere('process.company_id = :companyId', {
        companyId: filters.companyId,
      });
    }

    if (filters?.status) {
      queryBuilder.andWhere('worker.status = :status', {
        status: filters.status,
      });
    }

    if (filters?.search) {
      queryBuilder.andWhere(
        '(worker.firstName ILIKE :search OR worker.lastName ILIKE :search OR worker.rut ILIKE :search OR worker.email ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    queryBuilder.orderBy('worker.createdAt', 'DESC');

    return paginate(this.workerRepository, filters || {}, queryBuilder);
  }

  async findOne(id: string): Promise<Worker> {
    const worker = await this.workerRepository.findOne({
      where: { id },
      relations: [
        'user',
        'workerProcesses',
        'workerProcesses.process',
        'workerProcesses.process.company',
      ],
    });

    if (!worker) {
      throw new NotFoundException(`Trabajador con ID ${id} no encontrado`);
    }

    return worker;
  }

  async findByEmail(email: string): Promise<Worker> {
    const worker = await this.workerRepository.findOne({
      where: { email },
      relations: ['user', 'workerProcesses'],
    });

    if (!worker) {
      throw new NotFoundException(
        `Trabajador con email ${email} no encontrado`,
      );
    }

    return worker;
  }

  async update(id: string, updateWorkerDto: UpdateWorkerDto): Promise<Worker> {
    const worker = await this.findOne(id);

    if (updateWorkerDto.rut && updateWorkerDto.rut !== worker.rut) {
      const existingWorker = await this.workerRepository.findOne({
        where: { rut: updateWorkerDto.rut },
      });
      if (existingWorker) {
        throw new BadRequestException('RUT ya está en uso');
      }
    }

    if (updateWorkerDto.email && updateWorkerDto.email !== worker.email) {
      const existingWorker = await this.workerRepository.findOne({
        where: { email: updateWorkerDto.email },
      });
      if (existingWorker) {
        throw new BadRequestException('Email ya está en uso');
      }
    }

    Object.assign(worker, updateWorkerDto);
    return this.workerRepository.save(worker);
  }

  async remove(id: string): Promise<void> {
    // Verificar que el worker existe
    await this.findOne(id);

    console.log(`[WorkersService.remove] Iniciando eliminación de worker ${id}`);

    // Eliminar manualmente los datos relacionados ANTES de eliminar el worker
    // Esto evita errores de foreign key constraint
    
    // 1. Eliminar WorkerProcess (que a su vez eliminará TestResponse en cascada si está configurado)
    const workerProcessesCount = await this.workerProcessRepository.count({
      where: { worker: { id } },
    });
    
    if (workerProcessesCount > 0) {
      console.log(`[WorkersService.remove] Eliminando ${workerProcessesCount} workerProcess(es) relacionados`);
      await this.workerProcessRepository.delete({ worker: { id } });
    }

    // 2. Eliminar Reports relacionados
    const reportsCount = await this.reportRepository.count({
      where: { worker: { id } },
    });
    
    if (reportsCount > 0) {
      console.log(`[WorkersService.remove] Eliminando ${reportsCount} reporte(s) relacionado(s)`);
      await this.reportRepository.delete({ worker: { id } });
    }

    // 3. Eliminar WorkerVideoRequirements relacionados (si existen)
    // Nota: Esta entidad ya tiene CASCADE configurado, pero lo eliminamos manualmente por si acaso
    try {
      const videoRequirementsCount = await this.workerRepository
        .createQueryBuilder('worker')
        .leftJoinAndSelect('worker.videoRequirements', 'videoRequirements')
        .where('worker.id = :id', { id })
        .getCount();
      
      if (videoRequirementsCount > 0) {
        console.log(`[WorkersService.remove] Eliminando videoRequirements relacionados`);
      }
    } catch (error) {
      // Ignorar si no existe la relación
      console.log(`[WorkersService.remove] No se encontraron videoRequirements o la relación no existe`);
    }

    // 4. Eliminar el worker usando delete (más directo que remove)
    console.log(`[WorkersService.remove] Eliminando worker ${id}`);
    const deleteResult = await this.workerRepository.delete({ id });
    
    if (deleteResult.affected === 0) {
      throw new NotFoundException(`Trabajador con ID ${id} no encontrado`);
    }
    
    console.log(`[WorkersService.remove] Worker ${id} eliminado exitosamente`);
  }

  async applyToProcess(applyDto: ApplyToProcessDto): Promise<WorkerProcess> {
    const existingApplication = await this.workerProcessRepository.findOne({
      where: {
        worker: { id: applyDto.workerId },
        process: { id: applyDto.processId },
      },
    });

    if (existingApplication) {
      throw new BadRequestException(
        'El trabajador ya está aplicado a este proceso',
      );
    }

    const workerProcess = this.workerProcessRepository.create({
      worker: { id: applyDto.workerId } as Worker,
      process: { id: applyDto.processId } as any,
      status: WorkerStatus.PENDING,
      appliedAt: new Date(),
      notes: applyDto.notes,
    });

    const savedWorkerProcess = await this.workerProcessRepository.save(workerProcess);

    // Cargar relaciones para la notificación
    const workerProcessWithRelations = await this.workerProcessRepository.findOne({
      where: { id: savedWorkerProcess.id },
      relations: ['worker', 'process', 'process.company'],
    });

    // Notificar a todos los administradores sobre el nuevo postulante
    if (workerProcessWithRelations) {
      try {
        const admins = await this.usersService.findAdminUsers();
        const adminIds = admins.map((admin) => admin.id);

        if (adminIds.length > 0) {
          await this.notificationsGateway.broadcastNotification(adminIds, {
            title: 'Nuevo postulante en proceso',
            message: `${workerProcessWithRelations.worker.firstName} ${workerProcessWithRelations.worker.lastName} se ha postulado al proceso "${workerProcessWithRelations.process.name}"`,
            type: NotificationType.INFO,
            link: `/admin/procesos/${workerProcessWithRelations.process.id}`,
          });
        }

        // Notificar también a los usuarios de la empresa
        if (workerProcessWithRelations.process.company?.id) {
          const companyUsers = await this.usersService.findCompanyUsers(
            workerProcessWithRelations.process.company.id
          );
          const companyUserIds = companyUsers.map((user) => user.id);

          if (companyUserIds.length > 0) {
            await this.notificationsGateway.broadcastNotification(companyUserIds, {
              title: 'Nuevo postulante en tu proceso',
              message: `${workerProcessWithRelations.worker.firstName} ${workerProcessWithRelations.worker.lastName} se ha postulado al proceso "${workerProcessWithRelations.process.name}"`,
              type: NotificationType.INFO,
              link: `/empresa/procesos/${workerProcessWithRelations.process.id}`,
            });
          }
        }

        // Notificar al trabajador sobre su postulación exitosa y tests asignados
        const workerUserId = workerProcessWithRelations.worker.user?.id;
        if (workerUserId) {
          await this.notificationsGateway.broadcastNotification([workerUserId], {
            title: 'Postulación exitosa',
            message: `Te has postulado exitosamente al proceso "${workerProcessWithRelations.process.name}". Los tests han sido asignados.`,
            type: NotificationType.INFO,
            link: `/trabajador/procesos/${workerProcessWithRelations.process.id}/tests`,
          });
        }
      } catch (error) {
        this.logger.error(
          `Error sending notification for new application: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return savedWorkerProcess;
  }

  async getWorkerProcesses(workerId: string): Promise<WorkerProcess[]> {
    return this.workerProcessRepository.find({
      where: { worker: { id: workerId } },
      relations: ['process', 'testResponses'],
      order: { createdAt: 'DESC' },
    });
  }

  async getProcessWorkers(processId: string): Promise<WorkerProcess[]> {
    return this.workerProcessRepository.find({
      where: { process: { id: processId } },
      relations: ['worker', 'testResponses'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateWorkerProcessStatus(
    workerProcessId: string,
    updateDto: UpdateWorkerProcessStatusDto,
  ): Promise<WorkerProcess> {
    const workerProcess = await this.workerProcessRepository.findOne({
      where: { id: workerProcessId },
      relations: ['worker', 'worker.user', 'process'],
    });

    if (!workerProcess) {
      throw new NotFoundException(
        `WorkerProcess con ID ${workerProcessId} no encontrado`,
      );
    }

    const oldStatus = workerProcess.status;
    Object.assign(workerProcess, updateDto);
    workerProcess.evaluatedAt = new Date();

    const savedWorkerProcess = await this.workerProcessRepository.save(workerProcess);

    // Notificar al trabajador si su estado cambió
    if (updateDto.status && oldStatus !== updateDto.status) {
      try {
        const workerUserId = workerProcess.worker.user?.id;
        if (workerUserId) {
          const statusLabels = {
            [WorkerStatus.PENDING]: 'Pendiente',
            [WorkerStatus.IN_PROCESS]: 'En Proceso',
            [WorkerStatus.COMPLETED]: 'Completado',
            [WorkerStatus.APPROVED]: 'Aprobado',
            [WorkerStatus.REJECTED]: 'Rechazado',
          };

          await this.notificationsGateway.broadcastNotification([workerUserId], {
            title: 'Cambio de estado en tu aplicación',
            message: `Tu aplicación al proceso "${workerProcess.process.name}" ha cambiado a "${statusLabels[updateDto.status]}"`,
            type: updateDto.status === WorkerStatus.APPROVED
              ? NotificationType.SUCCESS
              : updateDto.status === WorkerStatus.REJECTED
                ? NotificationType.ERROR
                : NotificationType.INFO,
            link: `/trabajador/procesos/${workerProcess.process.id}`,
          });
        }
      } catch (error) {
        this.logger.error(
          `Error sending notification for status change: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return savedWorkerProcess;
  }

  async getWorkerProcessById(id: string): Promise<WorkerProcess> {
    const workerProcess = await this.workerProcessRepository.findOne({
      where: { id },
      relations: [
        'worker',
        'process',
        'process.company',
        'testResponses',
        'testResponses.test',
        'testResponses.fixedTest',
      ],
    });

    if (!workerProcess) {
      throw new NotFoundException(`WorkerProcess con ID ${id} no encontrado`);
    }

    return workerProcess;
  }

  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
  }> {
    const total = await this.workerRepository.count();

    const byStatus: Record<string, number> = {};
    for (const status of Object.values(WorkerStatus)) {
      byStatus[status] = await this.workerProcessRepository.count({
        where: { status },
      });
    }

    return {
      total,
      byStatus,
    };
  }

  async uploadCV(workerId: string, file: Express.Multer.File): Promise<Worker> {
    const worker = await this.findOne(workerId);

    try {
      // Delete old CV from S3 if exists
      if (worker.cvUrl) {
        try {
          const keyToDelete = extractS3KeyFromUrl(worker.cvUrl);

          // Only delete if it's an S3 key (not a local file path)
          if (keyToDelete && (keyToDelete.startsWith('cvs/') || keyToDelete.includes('/'))) {
            await this.s3Service.deleteFile(keyToDelete);
            this.logger.log(`Deleted old CV: ${keyToDelete}`);
          }
        } catch (err) {
          this.logger.warn(
            `Could not delete old CV: ${worker.cvUrl}. ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // Upload new CV to S3
      const uploadResult = await uploadFileAndGetPublicUrl(
        this.s3Service,
        file,
        'cvs',
        workerId,
      );

      this.logger.log(`CV uploaded to S3: ${uploadResult.key}`);

      // Update worker with new CV URL
      worker.cvUrl = uploadResult.url;
      return this.workerRepository.save(worker);
    } catch (error) {
      this.logger.error(
        `Failed to upload CV: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException(
        'No se pudo subir el CV. Intente nuevamente.',
      );
    }
  }

  async deleteCV(workerId: string): Promise<Worker> {
    const worker = await this.findOne(workerId);

    if (!worker.cvUrl) {
      throw new BadRequestException('El trabajador no tiene un CV para eliminar');
    }

    try {
      // Extract S3 key from URL or use as-is
      const key = extractS3KeyFromUrl(worker.cvUrl);

      // Delete from S3 if it's an S3 key
      if (key && (key.startsWith('cvs/') || key.includes('/'))) {
        await this.s3Service.deleteFile(key);
        this.logger.log(`CV deleted from S3: ${key}`);
      }

      // Clear CV field
      worker.cvUrl = null;
      return this.workerRepository.save(worker);
    } catch (error) {
      this.logger.error(
        `Failed to delete CV: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException(
        'No se pudo eliminar el CV. Intente nuevamente.',
      );
    }
  }

  // Keep old deleteCV method for backward compatibility
  async deleteCVOld(workerId: string): Promise<Worker> {
    const worker = await this.findOne(workerId);

    if (!worker.cvUrl) {
      throw new BadRequestException('El trabajador no tiene un CV cargado');
    }

    const cvPath = path.join(process.cwd(), worker.cvUrl);
    if (fs.existsSync(cvPath)) {
      fs.unlinkSync(cvPath);
    }

    worker.cvUrl = null;
    return this.workerRepository.save(worker);
  }

  async downloadCV(workerId: string): Promise<{ stream: any; filename: string }> {
    const worker = await this.findOne(workerId);

    if (!worker.cvUrl) {
      throw new NotFoundException('El trabajador no tiene un CV cargado');
    }

    this.logger.log(`Attempting to download CV for worker ${workerId}, cvUrl: ${worker.cvUrl}`);

    // Extract S3 key from URL or use as-is
    const key = extractS3KeyFromUrl(worker.cvUrl);
    this.logger.log(`Extracted S3 key: ${key}`);

    // If it's an S3 key (starts with a folder like 'cvs/' or 'reports/'), download from S3
    if (key && key.startsWith('cvs/')) {
      try {
        this.logger.log(`Downloading from S3 with key: ${key}`);
        const stream = await this.s3Service.getFileStream(key);
        const filename = key.split('/').pop() || 'cv.pdf';
        this.logger.log(`Successfully retrieved CV stream from S3: ${key}`);
        return { stream, filename };
      } catch (error) {
        this.logger.error(
          `Failed to download CV from S3 (key: ${key}): ${error instanceof Error ? error.message : String(error)}`,
        );
        throw new NotFoundException('No se pudo descargar el CV desde S3');
      }
    }

    // If it's a local file (legacy), read from filesystem
    this.logger.log(`Attempting to read CV from local filesystem: ${worker.cvUrl}`);
    const cvPath = path.join(process.cwd(), worker.cvUrl);
    if (!fs.existsSync(cvPath)) {
      this.logger.error(`Local CV file not found at path: ${cvPath}`);
      throw new NotFoundException('El archivo CV no existe en el servidor');
    }

    const stream = fs.createReadStream(cvPath);
    const filename = path.basename(cvPath);
    return { stream, filename };
  }

  async getDashboardStats(workerId: string) {
    await this.findOne(workerId);

    const totalAplicaciones = await this.workerProcessRepository.count({
      where: { worker: { id: workerId } },
    });

    const enProceso = await this.workerProcessRepository.count({
      where: {
        worker: { id: workerId },
        status: WorkerStatus.IN_PROCESS,
      },
    });

    const finalizadas = await this.workerProcessRepository.count({
      where: {
        worker: { id: workerId },
        status: In([
          WorkerStatus.APPROVED,
          WorkerStatus.REJECTED,
          WorkerStatus.HIRED,
        ]),
      },
    });

    const processIdsApplied = await this.workerProcessRepository
      .createQueryBuilder('wp')
      .select('wp.process_id', 'processId')
      .where('wp.worker_id = :workerId', { workerId })
      .getRawMany();

    const appliedProcessIds = processIdsApplied.map((p) => p.processId);

    const totalActive = await this.processRepository.count({
      where: { status: ProcessStatus.ACTIVE },
    });

    let disponibles: number;

    if (appliedProcessIds.length > 0) {
      const appliedActive = await this.processRepository
        .createQueryBuilder('process')
        .where('process.status = :status', { status: ProcessStatus.ACTIVE })
        .andWhere('process.id IN (:...ids)', { ids: appliedProcessIds })
        .getCount();

      disponibles = totalActive - appliedActive;
    } else {
      disponibles = totalActive;
    }

    return {
      aplicadas: totalAplicaciones,
      enProceso,
      finalizadas,
      disponibles,
    };
  }
}
