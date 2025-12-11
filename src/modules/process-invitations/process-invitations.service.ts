import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import {
  ProcessInvitation,
  ProcessInvitationStatus,
} from './entities/process-invitation.entity';
import {
  CreateProcessInvitationDto,
  BulkInviteWorkersDto,
  AcceptProcessInvitationDto,
  ProcessInvitationResponseDto,
  QueryProcessInvitationsDto,
} from './dto';
import { SelectionProcess } from '../processes/entities/selection-process.entity';
import { User } from '../users/entities/user.entity';
import { Worker } from '../workers/entities/worker.entity';
import { WorkerProcess } from '../workers/entities/worker-process.entity';
import { WorkerStatus } from '../../common/enums/worker-status.enum';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/helpers/pagination.helper';
import { EmailHelper } from '../../common/helpers/email.helper';

@Injectable()
export class ProcessInvitationsService {
  constructor(
    @InjectRepository(ProcessInvitation)
    private readonly invitationRepository: Repository<ProcessInvitation>,
    @InjectRepository(SelectionProcess)
    private readonly processRepository: Repository<SelectionProcess>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Worker)
    private readonly workerRepository: Repository<Worker>,
    @InjectRepository(WorkerProcess)
    private readonly workerProcessRepository: Repository<WorkerProcess>,
  ) {}

  /**
   * Genera un token único para la invitación
   */
  private generateUniqueToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Calcula la fecha de expiración (7 días desde ahora por defecto)
   */
  private calculateExpirationDate(days: number = 7): Date {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + days);
    return expirationDate;
  }

  /**
   * Verifica si el proceso existe y está activo
   */
  private async validateProcess(processId: string): Promise<SelectionProcess> {
    const process = await this.processRepository.findOne({
      where: { id: processId },
      relations: ['company'],
    });

    if (!process) {
      throw new NotFoundException(
        `Proceso con ID ${processId} no encontrado`,
      );
    }

    return process;
  }

  /**
   * Mapea una entidad a DTO de respuesta
   */
  private mapToResponseDto(
    invitation: ProcessInvitation,
  ): ProcessInvitationResponseDto {
    return {
      id: invitation.id,
      processId: invitation.process?.id,
      processName: invitation.process?.name,
      email: invitation.email,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      status: invitation.status,
      sentAt: invitation.sentAt,
      acceptedAt: invitation.acceptedAt,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
  }

  /**
   * Crea una invitación individual
   */
  async create(
    createDto: CreateProcessInvitationDto,
    createdById: string,
  ): Promise<ProcessInvitationResponseDto> {
    // Validar que el proceso existe
    const process = await this.validateProcess(createDto.processId);

    // Verificar si ya existe una invitación pendiente para este email y proceso
    const existingInvitation = await this.invitationRepository.findOne({
      where: {
        email: createDto.email.toLowerCase(),
        process: { id: createDto.processId },
        status: ProcessInvitationStatus.PENDING,
      },
    });

    if (existingInvitation) {
      throw new ConflictException(
        'Ya existe una invitación pendiente para este email en este proceso',
      );
    }

    // Crear la invitación
    const invitation = this.invitationRepository.create({
      process: { id: createDto.processId } as SelectionProcess,
      email: createDto.email.toLowerCase(),
      firstName: createDto.firstName,
      lastName: createDto.lastName,
      token: this.generateUniqueToken(),
      status: ProcessInvitationStatus.PENDING,
      expiresAt: this.calculateExpirationDate(),
      createdBy: { id: createdById } as User,
    });

    const savedInvitation = await this.invitationRepository.save(invitation);

    // Cargar las relaciones para la respuesta
    const invitationWithRelations = await this.invitationRepository.findOne({
      where: { id: savedInvitation.id },
      relations: ['process'],
    });

    // Enviar email con el token de invitación
    try {
      const frontendUrl = globalThis.process.env.FRONTEND_URL || 'http://localhost:5173';
      const invitationUrl = `${frontendUrl}/invitations/${invitationWithRelations.token}`;

      await EmailHelper.sendEmail(
        invitationWithRelations.email,
        `Invitación para postular al proceso: ${invitationWithRelations.process.name}`,
        `Hola ${invitationWithRelations.firstName} ${invitationWithRelations.lastName},\n\nHas sido invitado a postular al proceso: ${invitationWithRelations.process.name}\n\nPara aceptar, visita: ${invitationUrl}\n\nSaludos,\nEquipo Talentree`,
        `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1>¡Has sido invitado!</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p>Hola <strong>${invitationWithRelations.firstName} ${invitationWithRelations.lastName}</strong>,</p>
    <p>Has sido invitado a postular al siguiente proceso de selección:</p>
    <div style="background: white; border-left: 4px solid #14b8a6; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <h3 style="margin-top: 0; color: #14b8a6;">${invitationWithRelations.process.name}</h3>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${invitationUrl}" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Aceptar Invitación</a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">O copia este enlace: <a href="${invitationUrl}" style="color: #14b8a6;">${invitationUrl}</a></p>
    <p style="color: #92400e; background: #fffbeb; padding: 10px; border-radius: 4px;"><strong>⏰ Importante:</strong> Esta invitación expira en 7 días.</p>
  </div>
</body>
</html>
        `,
      );

      // Marcar como enviado
      invitationWithRelations.sentAt = new Date();
      await this.invitationRepository.save(invitationWithRelations);
    } catch (error) {
      // Log error pero no fallar - la invitación se creó correctamente
      console.error('Error sending invitation email:', error);
    }

    return this.mapToResponseDto(invitationWithRelations);
  }

  /**
   * Crea invitaciones en masa
   */
  async bulkCreate(
    bulkDto: BulkInviteWorkersDto,
    createdById: string,
  ): Promise<{
    successful: ProcessInvitationResponseDto[];
    failed: { email: string; reason: string }[];
  }> {
    // Validar que el proceso existe
    await this.validateProcess(bulkDto.processId);

    const successful: ProcessInvitationResponseDto[] = [];
    const failed: { email: string; reason: string }[] = [];

    for (const invitee of bulkDto.invitees) {
      try {
        const invitation = await this.create(
          {
            processId: bulkDto.processId,
            email: invitee.email,
            firstName: invitee.firstName,
            lastName: invitee.lastName,
          },
          createdById,
        );
        successful.push(invitation);
      } catch (error) {
        failed.push({
          email: invitee.email,
          reason: error.message || 'Error desconocido',
        });
      }
    }

    return { successful, failed };
  }

  /**
   * Acepta una invitación
   * Maneja 3 escenarios:
   * 1. Usuario no registrado -> debe registrarse primero
   * 2. Usuario registrado pero no es worker -> debe crear perfil de worker
   * 3. Usuario registrado y es worker -> aplicar directamente
   */
  async accept(
    acceptDto: AcceptProcessInvitationDto,
    userId?: string,
  ): Promise<{
    status: 'needs_registration' | 'needs_worker_profile' | 'applied';
    message: string;
    invitation: ProcessInvitationResponseDto;
    processId?: string;
  }> {
    // Buscar la invitación por token
    const invitation = await this.invitationRepository.findOne({
      where: { token: acceptDto.token },
      relations: ['process', 'process.company'],
    });

    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada');
    }

    // Verificar si la invitación ya fue aceptada
    if (invitation.status === ProcessInvitationStatus.ACCEPTED) {
      throw new BadRequestException('Esta invitación ya fue aceptada');
    }

    // Verificar si la invitación fue cancelada
    if (invitation.status === ProcessInvitationStatus.CANCELLED) {
      throw new BadRequestException('Esta invitación fue cancelada');
    }

    // Verificar si la invitación expiró
    if (
      invitation.status === ProcessInvitationStatus.EXPIRED ||
      new Date() > invitation.expiresAt
    ) {
      // Actualizar el estado si aún no está marcada como expirada
      if (invitation.status !== ProcessInvitationStatus.EXPIRED) {
        invitation.status = ProcessInvitationStatus.EXPIRED;
        await this.invitationRepository.save(invitation);
      }
      throw new BadRequestException('Esta invitación ha expirado');
    }

    // ESCENARIO 1: Usuario no está autenticado
    if (!userId) {
      return {
        status: 'needs_registration',
        message: 'Debes registrarte o iniciar sesión para aceptar esta invitación',
        invitation: this.mapToResponseDto(invitation),
        processId: invitation.process.id,
      };
    }

    // Buscar el usuario
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['worker'],
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar que el email del usuario coincida con el de la invitación
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new BadRequestException(
        'Esta invitación fue enviada a un email diferente',
      );
    }

    // ESCENARIO 2: Usuario registrado pero no tiene perfil de worker
    if (!user.worker) {
      return {
        status: 'needs_worker_profile',
        message: 'Debes completar tu perfil de trabajador para aceptar esta invitación',
        invitation: this.mapToResponseDto(invitation),
        processId: invitation.process.id,
      };
    }

    // ESCENARIO 3: Usuario registrado y tiene perfil de worker -> aplicar al proceso
    const worker = await this.workerRepository.findOne({
      where: { id: user.worker.id },
    });

    if (!worker) {
      throw new NotFoundException('Perfil de trabajador no encontrado');
    }

    // Verificar si ya está aplicado al proceso
    const existingApplication = await this.workerProcessRepository.findOne({
      where: {
        worker: { id: worker.id },
        process: { id: invitation.process.id },
      },
    });

    if (existingApplication) {
      throw new BadRequestException('Ya estás aplicado a este proceso');
    }

    // Crear la aplicación al proceso
    const workerProcess = this.workerProcessRepository.create({
      worker: { id: worker.id } as Worker,
      process: { id: invitation.process.id } as SelectionProcess,
      status: WorkerStatus.PENDING,
      appliedAt: new Date(),
    });

    await this.workerProcessRepository.save(workerProcess);

    // Actualizar la invitación como aceptada
    invitation.status = ProcessInvitationStatus.ACCEPTED;
    invitation.acceptedAt = new Date();
    await this.invitationRepository.save(invitation);

    // Enviar email de bienvenida al proceso
    try {
      const workerName = `${user.firstName} ${user.lastName}`;
      const processName = invitation.process.name;
      const companyName = invitation.process.company?.name || 'la empresa';
      const position = invitation.process.position || processName;

      await this.sendWelcomeToProcessEmail(
        user.email,
        workerName,
        processName,
        companyName,
        position,
      );
    } catch (error) {
      // Log error pero no fallar - la aplicación se creó correctamente
      console.error('Error sending welcome email:', error);
    }

    return {
      status: 'applied',
      message: 'Invitación aceptada y aplicación al proceso completada',
      invitation: this.mapToResponseDto(invitation),
    };
  }

  /**
   * Obtiene invitaciones con filtros y paginación
   */
  async findAll(
    queryDto: QueryProcessInvitationsDto,
  ): Promise<PaginatedResult<ProcessInvitationResponseDto>> {
    const queryBuilder = this.invitationRepository
      .createQueryBuilder('invitation')
      .leftJoinAndSelect('invitation.process', 'process')
      .leftJoinAndSelect('invitation.createdBy', 'createdBy');

    // Filtrar por proceso
    if (queryDto.processId) {
      queryBuilder.andWhere('process.id = :processId', {
        processId: queryDto.processId,
      });
    }

    // Filtrar por estado
    if (queryDto.status) {
      queryBuilder.andWhere('invitation.status = :status', {
        status: queryDto.status,
      });
    }

    // Buscar por email, nombre o apellido
    if (queryDto.search) {
      queryBuilder.andWhere(
        '(invitation.email ILIKE :search OR invitation.firstName ILIKE :search OR invitation.lastName ILIKE :search)',
        { search: `%${queryDto.search}%` },
      );
    }

    queryBuilder.orderBy('invitation.createdAt', 'DESC');

    const paginatedResult = await paginate(
      this.invitationRepository,
      queryDto,
      queryBuilder,
    );

    return {
      ...paginatedResult,
      data: paginatedResult.data.map((inv) => this.mapToResponseDto(inv)),
    };
  }

  /**
   * Obtiene una invitación por ID
   */
  async findOne(id: string): Promise<ProcessInvitationResponseDto> {
    const invitation = await this.invitationRepository.findOne({
      where: { id },
      relations: ['process', 'createdBy'],
    });

    if (!invitation) {
      throw new NotFoundException(`Invitación con ID ${id} no encontrada`);
    }

    return this.mapToResponseDto(invitation);
  }

  /**
   * Obtiene una invitación por token (para validación pública)
   */
  async findByToken(token: string): Promise<ProcessInvitationResponseDto> {
    const invitation = await this.invitationRepository.findOne({
      where: { token },
      relations: ['process'],
    });

    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada');
    }

    // Verificar si expiró y actualizar estado
    if (
      invitation.status === ProcessInvitationStatus.PENDING &&
      new Date() > invitation.expiresAt
    ) {
      invitation.status = ProcessInvitationStatus.EXPIRED;
      await this.invitationRepository.save(invitation);
    }

    return this.mapToResponseDto(invitation);
  }

  /**
   * Obtiene todas las invitaciones pendientes de un trabajador por su email
   * Usado para mostrar invitaciones en el dashboard del trabajador
   */
  async findByEmail(email: string): Promise<ProcessInvitationResponseDto[]> {
    const invitations = await this.invitationRepository.find({
      where: {
        email: email.toLowerCase(),
        status: ProcessInvitationStatus.PENDING,
      },
      relations: ['process', 'process.company'],
      order: { createdAt: 'DESC' },
    });

    // Verificar invitaciones expiradas y actualizar estado
    const now = new Date();
    const validInvitations = [];

    for (const invitation of invitations) {
      if (now > invitation.expiresAt) {
        invitation.status = ProcessInvitationStatus.EXPIRED;
        await this.invitationRepository.save(invitation);
      } else {
        validInvitations.push(invitation);
      }
    }

    return validInvitations.map((inv) => this.mapToResponseDto(inv));
  }

  /**
   * Cancela una invitación
   */
  async cancel(id: string): Promise<ProcessInvitationResponseDto> {
    const invitation = await this.invitationRepository.findOne({
      where: { id },
      relations: ['process'],
    });

    if (!invitation) {
      throw new NotFoundException(`Invitación con ID ${id} no encontrada`);
    }

    if (invitation.status === ProcessInvitationStatus.ACCEPTED) {
      throw new BadRequestException(
        'No se puede cancelar una invitación que ya fue aceptada',
      );
    }

    invitation.status = ProcessInvitationStatus.CANCELLED;
    const updated = await this.invitationRepository.save(invitation);

    return this.mapToResponseDto(updated);
  }

  /**
   * Reenvía una invitación (genera nuevo token y extiende expiración)
   */
  async resend(id: string): Promise<ProcessInvitationResponseDto> {
    const invitation = await this.invitationRepository.findOne({
      where: { id },
      relations: ['process'],
    });

    if (!invitation) {
      throw new NotFoundException(`Invitación con ID ${id} no encontrada`);
    }

    if (invitation.status === ProcessInvitationStatus.ACCEPTED) {
      throw new BadRequestException(
        'No se puede reenviar una invitación que ya fue aceptada',
      );
    }

    // Generar nuevo token y extender expiración
    invitation.token = this.generateUniqueToken();
    invitation.expiresAt = this.calculateExpirationDate();
    invitation.status = ProcessInvitationStatus.PENDING;

    const updated = await this.invitationRepository.save(invitation);

    // Reenviar email
    try {
      const frontendUrl = globalThis.process.env.FRONTEND_URL || 'http://localhost:5173';
      const invitationUrl = `${frontendUrl}/invitations/${updated.token}`;

      await EmailHelper.sendEmail(
        updated.email,
        `Invitación para postular al proceso: ${updated.process.name}`,
        `Hola ${updated.firstName} ${updated.lastName},\n\nHas sido invitado a postular al proceso: ${updated.process.name}\n\nPara aceptar, visita: ${invitationUrl}\n\nSaludos,\nEquipo Talentree`,
        `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1>¡Has sido invitado!</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p>Hola <strong>${updated.firstName} ${updated.lastName}</strong>,</p>
    <p>Has sido invitado a postular al siguiente proceso de selección:</p>
    <div style="background: white; border-left: 4px solid #14b8a6; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <h3 style="margin-top: 0; color: #14b8a6;">${updated.process.name}</h3>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${invitationUrl}" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Aceptar Invitación</a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">O copia este enlace: <a href="${invitationUrl}" style="color: #14b8a6;">${invitationUrl}</a></p>
    <p style="color: #92400e; background: #fffbeb; padding: 10px; border-radius: 4px;"><strong>⏰ Importante:</strong> Esta invitación expira en 7 días.</p>
  </div>
</body>
</html>
        `,
      );

      // Marcar como enviado
      updated.sentAt = new Date();
      await this.invitationRepository.save(updated);
    } catch (error) {
      // Log error pero no fallar
      console.error('Error resending invitation email:', error);
    }

    return this.mapToResponseDto(updated);
  }

  /**
   * Marca invitaciones expiradas (puede ser ejecutado por un cron job)
   */
  async markExpiredInvitations(): Promise<number> {
    const result = await this.invitationRepository
      .createQueryBuilder()
      .update(ProcessInvitation)
      .set({ status: ProcessInvitationStatus.EXPIRED })
      .where('status = :status', { status: ProcessInvitationStatus.PENDING })
      .andWhere('expiresAt < :now', { now: new Date() })
      .execute();

    return result.affected || 0;
  }

  /**
   * Envía email de bienvenida al proceso
   */
  private async sendWelcomeToProcessEmail(
    email: string,
    workerName: string,
    processName: string,
    companyName: string,
    position: string,
  ): Promise<void> {
    const subject = `¡Bienvenido al proceso de selección para ${position}!`;

    const textContent = `Hola ${workerName},

¡Gracias por aceptar la invitación y postularte al proceso de selección "${processName}" en ${companyName}!

Tu postulación ha sido recibida exitosamente. Ahora puedes comenzar a completar las evaluaciones asignadas.

Pasos a seguir:
1. Ingresa a la plataforma Talentree
2. Ve a la sección "Mis Procesos"
3. Completa los tests y evaluaciones asignadas

Te recomendamos completar las evaluaciones lo antes posible para avanzar en el proceso de selección.

¡Mucho éxito!

Saludos,
Equipo Talentree`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .welcome-badge { background: #d1fae5; color: #065f46; padding: 15px 25px; border-radius: 50px; display: inline-block; font-weight: bold; margin: 20px 0; }
    .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #14b8a6; }
    .steps { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .step { display: flex; align-items: center; margin: 15px 0; }
    .step-number { background: #14b8a6; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-weight: bold; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>¡Bienvenido/a al Proceso!</h1>
    </div>
    <div class="content">
      <p>Hola <strong>${workerName}</strong>,</p>

      <div style="text-align: center;">
        <span class="welcome-badge">✓ Invitación Aceptada</span>
      </div>

      <p>¡Gracias por aceptar nuestra invitación! Tu interés en formar parte de nuestro equipo es muy importante para nosotros.</p>

      <div class="info-box">
        <p style="margin: 0;"><strong>Proceso:</strong> ${processName}</p>
        <p style="margin: 10px 0 0 0;"><strong>Empresa:</strong> ${companyName}</p>
        <p style="margin: 10px 0 0 0;"><strong>Cargo:</strong> ${position}</p>
      </div>

      <div class="steps">
        <h3 style="margin-top: 0; color: #0d9488;">Próximos pasos:</h3>
        <div class="step">
          <span class="step-number">1</span>
          <span>Ingresa a la plataforma Talentree</span>
        </div>
        <div class="step">
          <span class="step-number">2</span>
          <span>Ve a la sección "Mis Procesos"</span>
        </div>
        <div class="step">
          <span class="step-number">3</span>
          <span>Completa los tests y evaluaciones asignadas</span>
        </div>
      </div>

      <p style="color: #059669; background: #d1fae5; padding: 15px; border-radius: 8px; text-align: center;">
        <strong>💡 Tip:</strong> Te recomendamos completar las evaluaciones lo antes posible para avanzar en el proceso de selección.
      </p>

      <div class="footer">
        <p>¡Mucho éxito en tu proceso!</p>
        <p>Equipo Talentree</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    await EmailHelper.sendEmail(email, subject, textContent, htmlContent);
  }
}
