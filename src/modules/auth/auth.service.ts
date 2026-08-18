import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterWorkerDto } from './dto/register-worker.dto';
import { Worker } from '../workers/entities/worker.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../../common/enums/audit-action.enum';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(Worker)
    private readonly workerRepository: Repository<Worker>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly auditService: AuditService,
  ) {}

  /**
   * P-44. El inicio de sesion no quedaba en la bitacora. El interceptor de
   * auditoria no puede registrarlo: en el momento en que pasa, la peticion
   * todavia no tiene usuario (la ruta es publica). Hay que hacerlo aqui, que
   * es donde se sabe quien entro y si lo logro.
   */
  async login(
    loginDto: LoginDto,
    contexto?: { ip?: string; userAgent?: string },
  ) {
    const { email, password } = loginDto;

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    await this.usersService.updateLastLogin(user.id);

    this.auditService
      .log(AuditAction.LOGIN, 'auth', user.id, user.id, {
        ipAddress: contexto?.ip,
        userAgent: contexto?.userAgent,
        description: `Inicio de sesion de ${user.email}`,
      })
      // Que falle la bitacora no puede impedir que alguien entre.
      .catch((error) =>
        this.logger.error(
          `No se pudo auditar el inicio de sesion: ${error.message}`,
        ),
      );

    const accessToken = this.generateAccessToken(
      user.id,
      user.email,
      user.role,
    );
    const refreshToken = this.generateRefreshToken(user.id);

    const userWithRelations = await this.usersService.findOneWithRelations(
      user.id,
    );

    return {
      user: userWithRelations,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Cambia la empresa activa del representante.
   *
   * Queda auditado: es un cambio de contexto de la sesion, y si mañana hay que
   * reconstruir quien miro los datos de que empresa y cuando, sin este registro
   * la bitacora muestra al mismo usuario operando sobre dos empresas sin
   * ninguna marca de cuando salto de una a otra.
   */
  async setActiveCompany(userId: string, companyId: string) {
    const user = await this.usersService.setActiveCompany(userId, companyId);

    this.auditService
      .log(AuditAction.UPDATE, 'auth', userId, userId, {
        description: `Cambio de empresa activa a "${user.company?.name ?? companyId}"`,
      })
      .catch((error) =>
        this.logger.error(
          `No se pudo auditar el cambio de empresa activa: ${error.message}`,
        ),
      );

    return user;
  }

  async validateUser(userId: string) {
    const user = await this.usersService.findOneWithRelations(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no válido');
    }

    return user;
  }

  /**
   * P-44. El cierre de sesion tampoco quedaba registrado. Se deja explicito,
   * igual que el inicio, para que la bitacora permita reconstruir una sesion
   * de punta a punta y no solo lo que se hizo en medio.
   */
  async logout(userId: string, contexto?: { ip?: string; userAgent?: string }) {
    await this.auditService
      .log(AuditAction.LOGOUT, 'auth', userId, userId, {
        ipAddress: contexto?.ip,
        userAgent: contexto?.userAgent,
        description: 'Cierre de sesion',
      })
      .catch((error) =>
        this.logger.error(
          `No se pudo auditar el cierre de sesion: ${error.message}`,
        ),
      );

    return { message: 'Logout exitoso' };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findOneWithRelations(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Token inválido');
      }

      const accessToken = this.generateAccessToken(
        user.id,
        user.email,
        user.role,
      );

      return { accessToken };
    } catch (error) {
      throw new UnauthorizedException(
        'Tu sesion no es valida o expiro. Vuelve a iniciar sesion.',
      );
    }
  }

  private generateAccessToken(
    userId: string,
    email: string,
    role: string,
  ): string {
    const payload = { sub: userId, email, role };
    return this.jwtService.sign(payload);
  }

  private generateRefreshToken(userId: string): string {
    const payload = { sub: userId };
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn:
        this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d',
    });
  }

  async registerWorker(registerDto: RegisterWorkerDto) {
    const existingUserByEmail = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });
    if (existingUserByEmail) {
      throw new ConflictException('El email ya está registrado');
    }

    const existingWorkerByRut = await this.workerRepository.findOne({
      where: { rut: registerDto.rut },
    });
    if (existingWorkerByRut) {
      throw new ConflictException('El RUT ya está registrado');
    }

    const existingWorkerByEmail = await this.workerRepository.findOne({
      where: { email: registerDto.email },
    });
    if (existingWorkerByEmail) {
      throw new ConflictException(
        'El email ya está registrado como trabajador',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const hashedPassword = await bcrypt.hash(registerDto.password, 10);

      const user = queryRunner.manager.create(User, {
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        phone: registerDto.phone,
        role: UserRole.WORKER,
        isActive: true,
        isEmailVerified: false,
      });
      const savedUser = await queryRunner.manager.save(User, user);

      const worker = queryRunner.manager.create(Worker, {
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        rut: registerDto.rut,
        email: registerDto.email,
        phone: registerDto.phone,
        birthDate: registerDto.birthDate
          ? new Date(registerDto.birthDate)
          : null,
        address: registerDto.address,
        city: registerDto.city,
        region: registerDto.region,
        education: registerDto.education,
        experience: registerDto.experience,
        user: savedUser,
      });
      await queryRunner.manager.save(Worker, worker);

      await queryRunner.commitTransaction();

      // Notificar a todos los administradores sobre el nuevo trabajador
      try {
        const admins = await this.usersService.findAdminUsers();
        const adminIds = admins.map((admin) => admin.id);

        if (adminIds.length > 0) {
          await this.notificationsGateway.broadcastNotification(adminIds, {
            title: 'Nuevo trabajador registrado',
            message: `${registerDto.firstName} ${registerDto.lastName} se ha registrado en la plataforma`,
            type: NotificationType.INFO,
            link: `/admin/trabajadores`,
          });
        }
      } catch (error) {
        this.logger.error(
          `Error sending notification for new worker: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      const accessToken = this.generateAccessToken(
        savedUser.id,
        savedUser.email,
        savedUser.role,
      );
      const refreshToken = this.generateRefreshToken(savedUser.id);

      const userWithRelations = await this.usersService.findOneWithRelations(
        savedUser.id,
      );

      return {
        user: userWithRelations,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Error al registrar el trabajador');
    } finally {
      await queryRunner.release();
    }
  }
}
