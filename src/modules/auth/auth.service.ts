import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
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

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(Worker)
    private readonly workerRepository: Repository<Worker>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async login(loginDto: LoginDto) {
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

  async validateUser(userId: string) {
    const user = await this.usersService.findOneWithRelations(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no válido');
    }

    return user;
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
      throw new UnauthorizedException(`Invalid token: ${error.message}`);
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
