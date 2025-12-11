import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Worker } from '../workers/entities/worker.entity';
import { SelectionProcess } from '../processes/entities/selection-process.entity';
import { Report } from '../reports/entities/report.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Company } from '../companies/entities/company.entity';
import { Invitation } from '../invitations/entities/invitation.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UserRole } from '../../common/enums/user-role.enum';
import * as bcrypt from 'bcrypt';
import { S3Service } from '../../common/services/s3.service';
import { uploadFileAndGetPublicUrl } from '../../common/helpers/s3.helper';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Worker)
    private readonly workerRepository: Repository<Worker>,
    @InjectRepository(SelectionProcess)
    private readonly processRepository: Repository<SelectionProcess>,
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Invitation)
    private readonly invitationRepository: Repository<Invitation>,
    private readonly s3Service: S3Service,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    const savedUser = await this.userRepository.save(user);

    // Solo crear Worker automáticamente (los demás roles se manejan desde frontend)
    if (savedUser.role === UserRole.WORKER) {
      const worker = this.workerRepository.create({
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        email: savedUser.email,
        rut: '',
        user: savedUser,
      });
      await this.workerRepository.save(worker);

      return this.findOneWithRelations(savedUser.id);
    }

    return savedUser;
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      relations: ['worker', 'company', 'belongsToCompany'],
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  /**
   * Busca un usuario por ID y carga las relaciones según su rol
   * - WORKER: carga relación worker
   * - COMPANY: carga relación company (cuando es dueño)
   * - GUEST/otros: carga relación belongsToCompany (cuando pertenece a una empresa)
   */
  async findOneWithRelations(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['worker', 'company', 'belongsToCompany'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      relations: ['worker', 'company', 'belongsToCompany'],
      select: [
        'id',
        'email',
        'password',
        'firstName',
        'lastName',
        'phone',
        'avatar',
        'role',
        'isActive',
        'isEmailVerified',
        'lastLogin',
        'notificationPreferences',
        'createdAt',
        'updatedAt',
      ],
    });
  }

  async findByRole(role: UserRole): Promise<User[]> {
    return this.userRepository.find({
      where: { role },
    });
  }

  async findAdminUsers(): Promise<User[]> {
    return this.findByRole(UserRole.ADMIN_TALENTREE);
  }

  async findCompanyUsers(companyId: string): Promise<User[]> {
    // Obtener el usuario dueño de la empresa + usuarios que pertenecen a la empresa
    const companyOwner = await this.userRepository.findOne({
      where: { company: { id: companyId } },
    });

    const companyMembers = await this.userRepository.find({
      where: { belongsToCompany: { id: companyId } },
    });

    const allUsers = companyOwner ? [companyOwner, ...companyMembers] : companyMembers;

    // Filtrar solo usuarios activos
    return allUsers.filter(user => user.isActive);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    await this.findOne(id);

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    await this.userRepository.update(id, updateUserDto);
    // Retornar usuario con relaciones cargadas para mantener consistencia
    return this.findOneWithRelations(id);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);

    this.logger.log(`[UsersService.remove] Iniciando eliminación de usuario ${id}`);

    // 1. Remover usuario de la tabla de evaluadores (ManyToMany con procesos)
    const processesAsEvaluator = await this.processRepository
      .createQueryBuilder('process')
      .innerJoin('process.evaluators', 'evaluator')
      .where('evaluator.id = :id', { id })
      .getMany();

    if (processesAsEvaluator.length > 0) {
      this.logger.log(`[UsersService.remove] Removiendo usuario de ${processesAsEvaluator.length} proceso(s) como evaluador`);
      for (const process of processesAsEvaluator) {
        await this.processRepository
          .createQueryBuilder()
          .relation(SelectionProcess, 'evaluators')
          .of(process.id)
          .remove(id);
      }
    }

    // 2. Eliminar procesos creados por el usuario
    const processesCreated = await this.processRepository
      .createQueryBuilder('process')
      .where('process.created_by_id = :id', { id })
      .getCount();

    if (processesCreated > 0) {
      this.logger.log(`[UsersService.remove] Eliminando ${processesCreated} proceso(s) creado(s) por el usuario`);
      await this.processRepository
        .createQueryBuilder()
        .delete()
        .from(SelectionProcess)
        .where('created_by_id = :id', { id })
        .execute();
    }

    // 3. Eliminar reportes creados por el usuario
    const reportsCreated = await this.reportRepository
      .createQueryBuilder('report')
      .where('report.created_by_id = :id', { id })
      .getCount();

    if (reportsCreated > 0) {
      this.logger.log(`[UsersService.remove] Eliminando ${reportsCreated} reporte(s) creado(s) por el usuario`);
      await this.reportRepository
        .createQueryBuilder()
        .delete()
        .from(Report)
        .where('created_by_id = :id', { id })
        .execute();
    }

    // 4. Eliminar invitaciones donde el usuario es el invitado (user_id)
    const invitationsAsUser = await this.invitationRepository
      .createQueryBuilder('invitation')
      .where('invitation.user_id = :id', { id })
      .getCount();

    if (invitationsAsUser > 0) {
      this.logger.log(`[UsersService.remove] Eliminando ${invitationsAsUser} invitación(es) donde el usuario es el invitado`);
      await this.invitationRepository
        .createQueryBuilder()
        .delete()
        .from(Invitation)
        .where('user_id = :id', { id })
        .execute();
    }

    // 5. Eliminar invitaciones creadas por el usuario (invited_by_id)
    const invitationsCreated = await this.invitationRepository
      .createQueryBuilder('invitation')
      .where('invitation.invited_by_id = :id', { id })
      .getCount();

    if (invitationsCreated > 0) {
      this.logger.log(`[UsersService.remove] Eliminando ${invitationsCreated} invitación(es) creada(s) por el usuario`);
      await this.invitationRepository
        .createQueryBuilder()
        .delete()
        .from(Invitation)
        .where('invited_by_id = :id', { id })
        .execute();
    }

    // 6. Eliminar todas las invitaciones con el mismo email del usuario de la misma empresa (para evitar duplicados)
    // Esto incluye invitaciones pendientes o aceptadas que puedan tener el mismo email
    if (user.email && user.companyId) {
      const invitationsByEmail = await this.invitationRepository
        .createQueryBuilder('invitation')
        .where('invitation.email = :email', { email: user.email })
        .andWhere('invitation.company_id = :companyId', { companyId: user.companyId })
        .getCount();

      if (invitationsByEmail > 0) {
        this.logger.log(`[UsersService.remove] Eliminando ${invitationsByEmail} invitación(es) con el mismo email del usuario (${user.email}) de la empresa ${user.companyId}`);
        await this.invitationRepository
          .createQueryBuilder()
          .delete()
          .from(Invitation)
          .where('email = :email', { email: user.email })
          .andWhere('company_id = :companyId', { companyId: user.companyId })
          .execute();
      }
    } else if (user.email) {
      // Si no tiene companyId, eliminar todas las invitaciones con ese email (caso menos común)
      const invitationsByEmail = await this.invitationRepository
        .createQueryBuilder('invitation')
        .where('invitation.email = :email', { email: user.email })
        .getCount();

      if (invitationsByEmail > 0) {
        this.logger.log(`[UsersService.remove] Eliminando ${invitationsByEmail} invitación(es) con el mismo email del usuario (${user.email})`);
        await this.invitationRepository
          .createQueryBuilder()
          .delete()
          .from(Invitation)
          .where('email = :email', { email: user.email })
          .execute();
      }
    }

    // 7. Eliminar empresa si el usuario es dueño de una empresa
    const companyOwned = await this.companyRepository.findOne({
      where: { user: { id } },
    });

    if (companyOwned) {
      this.logger.log(`[UsersService.remove] Eliminando empresa ${companyOwned.id} asociada al usuario`);
      await this.companyRepository.delete({ id: companyOwned.id });
    }

    // 8. Eliminar logs de auditoría del usuario
    const auditLogsCount = await this.auditLogRepository.count({
      where: { user: { id } },
    });

    if (auditLogsCount > 0) {
      this.logger.log(`[UsersService.remove] Eliminando ${auditLogsCount} log(s) de auditoría`);
      await this.auditLogRepository.delete({ user: { id } });
    }

    // 9. Eliminar notificaciones del usuario
    const notificationsCount = await this.notificationRepository.count({
      where: { user: { id } },
    });

    if (notificationsCount > 0) {
      this.logger.log(`[UsersService.remove] Eliminando ${notificationsCount} notificación(es)`);
      await this.notificationRepository.delete({ user: { id } });
    }

    // 10. Eliminar worker si existe (OneToOne)
    const worker = await this.workerRepository.findOne({
      where: { user: { id } },
    });

    if (worker) {
      this.logger.log(`[UsersService.remove] Eliminando worker asociado`);
      await this.workerRepository.delete({ id: worker.id });
    }

    // 11. Finalmente, eliminar el usuario
    this.logger.log(`[UsersService.remove] Eliminando usuario ${id}`);
    await this.userRepository.delete(id);

    this.logger.log(`[UsersService.remove] Usuario ${id} eliminado exitosamente`);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userRepository.update(id, { lastLogin: new Date() });
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'password'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const isPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    const hashedNewPassword = await bcrypt.hash(
      changePasswordDto.newPassword,
      10,
    );

    await this.userRepository.update(userId, { password: hashedNewPassword });

    return { message: 'Contraseña actualizada exitosamente' };
  }

  // Reset password by admin (no require current password)
  async resetPassword(
    userId: string,
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const hashedNewPassword = await bcrypt.hash(
      resetPasswordDto.newPassword,
      10,
    );

    await this.userRepository.update(userId, { password: hashedNewPassword });

    this.logger.log(`Password reset for user ${userId} by admin`);
    return { message: 'Contraseña restablecida exitosamente' };
  }

  async updateNotificationPreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<User> {
    await this.findOne(userId);

    // Log detallado del DTO recibido
    this.logger.log(
      `[updateNotificationPreferences] DTO recibido para usuario ${userId}: ${JSON.stringify(dto)}`,
    );
    this.logger.log(
      `[updateNotificationPreferences] DTO keys: ${Object.keys(dto).join(', ')}`,
    );
    this.logger.log(
      `[updateNotificationPreferences] DTO values: ${Object.values(dto).join(', ')}`,
    );

    // Construir objeto limpio solo con los campos que vienen en el DTO
    // Usar 'in' operator para verificar si la propiedad existe (incluso si es false)
    const preferences: Record<string, boolean> = {};
    
    if ('emailNotifications' in dto && dto.emailNotifications !== undefined) {
      preferences.emailNotifications = Boolean(dto.emailNotifications);
    }
    if ('newProcesses' in dto && dto.newProcesses !== undefined) {
      preferences.newProcesses = Boolean(dto.newProcesses);
    }
    if ('applicationUpdates' in dto && dto.applicationUpdates !== undefined) {
      preferences.applicationUpdates = Boolean(dto.applicationUpdates);
    }
    if ('testReminders' in dto && dto.testReminders !== undefined) {
      preferences.testReminders = Boolean(dto.testReminders);
    }
    if ('newEvaluations' in dto && dto.newEvaluations !== undefined) {
      preferences.newEvaluations = Boolean(dto.newEvaluations);
    }
    if ('candidateUpdates' in dto && dto.candidateUpdates !== undefined) {
      preferences.candidateUpdates = Boolean(dto.candidateUpdates);
    }
    if ('processReminders' in dto && dto.processReminders !== undefined) {
      preferences.processReminders = Boolean(dto.processReminders);
    }

    // Log para debugging
    this.logger.log(
      `[updateNotificationPreferences] Preferences a guardar: ${JSON.stringify(preferences)}`,
    );
    this.logger.log(
      `[updateNotificationPreferences] Preferences keys: ${Object.keys(preferences).join(', ')}`,
    );

    // Si no hay preferencias para actualizar, lanzar error
    if (Object.keys(preferences).length === 0) {
      this.logger.error(
        `[updateNotificationPreferences] ERROR: No notification preferences provided for user ${userId}. DTO recibido: ${JSON.stringify(dto)}`,
      );
      throw new BadRequestException(
        'Debe proporcionar al menos una preferencia de notificación',
      );
    }

    // Reemplazar completamente las preferencias (no hacer merge)
    const updateResult = await this.userRepository.update(userId, {
      notificationPreferences: preferences,
    });

    this.logger.log(
      `[updateNotificationPreferences] Update result: ${JSON.stringify(updateResult)}`,
    );

    // Retornar usuario con relaciones cargadas para mantener consistencia con el login
    const updatedUser = await this.findOneWithRelations(userId);
    
    this.logger.log(
      `[updateNotificationPreferences] Usuario actualizado: ${JSON.stringify(updatedUser.notificationPreferences)}`,
    );

    return updatedUser;
  }

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<User> {
    const user = await this.findOne(userId);

    try {
      // Delete old avatar from S3 if exists
      if (user.avatar && user.avatar.startsWith('avatars/')) {
        try {
          await this.s3Service.deleteFile(user.avatar);
          this.logger.log(`Deleted old avatar: ${user.avatar}`);
        } catch (err) {
          this.logger.warn(
            `Could not delete old avatar: ${user.avatar}. ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // Upload new avatar to S3
      const uploadResult = await uploadFileAndGetPublicUrl(
        this.s3Service,
        file,
        'avatars',
        userId,
      );

      this.logger.log(`Avatar uploaded to S3: ${uploadResult.key}`);

      // Update user with new avatar URL
      user.avatar = uploadResult.url;
      return this.userRepository.save(user);
    } catch (error) {
      this.logger.error(
        `Failed to upload avatar: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException(
        'No se pudo subir el avatar. Intente nuevamente.',
      );
    }
  }

  async deleteAvatar(userId: string): Promise<User> {
    const user = await this.findOne(userId);

    if (!user.avatar) {
      throw new BadRequestException('El usuario no tiene un avatar para eliminar');
    }

    try {
      // Delete from S3 if it's an S3 URL
      if (user.avatar.startsWith('avatars/')) {
        await this.s3Service.deleteFile(user.avatar);
        this.logger.log(`Avatar deleted from S3: ${user.avatar}`);
      }

      // Clear avatar field
      user.avatar = null;
      return this.userRepository.save(user);
    } catch (error) {
      this.logger.error(
        `Failed to delete avatar: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException(
        'No se pudo eliminar el avatar. Intente nuevamente.',
      );
    }
  }
}
