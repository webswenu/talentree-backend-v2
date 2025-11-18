import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan, QueryFailedError } from 'typeorm';
import { Company } from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyFilterDto } from './dto/company-filter.dto';
import { SelectionProcess } from '../processes/entities/selection-process.entity';
import { WorkerProcess } from '../workers/entities/worker-process.entity';
import { ProcessStatus } from '../../common/enums/process-status.enum';
import { WorkerStatus } from '../../common/enums/worker-status.enum';
import { UsersService } from '../users/users.service';
import { paginate } from '../../common/helpers/pagination.helper';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { S3Service } from '../../common/services/s3.service';
import { uploadFileAndGetPublicUrl } from '../../common/helpers/s3.helper';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(SelectionProcess)
    private readonly processRepository: Repository<SelectionProcess>,
    @InjectRepository(WorkerProcess)
    private readonly workerProcessRepository: Repository<WorkerProcess>,
    private readonly usersService: UsersService,
    private readonly s3Service: S3Service,
  ) {}

  async create(createCompanyDto: CreateCompanyDto): Promise<Company> {
    const { userId, ...companyData } = createCompanyDto;

    // Verificar RUT duplicado solo si se proporciona
    if (companyData.rut) {
      const existingCompany = await this.companyRepository.findOne({
        where: { rut: companyData.rut },
      });

      if (existingCompany) {
        throw new ConflictException('El RUT ya está registrado');
      }
    }

    // Solo buscar usuario si se proporciona userId
    let user = null;
    if (userId) {
      user = await this.usersService.findOne(userId);
    }

    // Crear empresa con o sin usuario
    const company = this.companyRepository.create({
      ...companyData,
      contractStartDate: new Date(),
      ...(user && { user }),
    });

    return this.companyRepository.save(company);
  }

  async findAll(filters?: CompanyFilterDto): Promise<PaginatedResult<Company>> {
    const queryBuilder = this.companyRepository
      .createQueryBuilder('company')
      .leftJoinAndSelect('company.user', 'user');

    if (filters?.active !== undefined) {
      queryBuilder.andWhere('company.active = :active', {
        active: filters.active,
      });
    }

    if (filters?.search) {
      queryBuilder.andWhere(
        '(company.name ILIKE :search OR company.rut ILIKE :search OR company.businessName ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    queryBuilder.orderBy('company.createdAt', 'DESC');

    return paginate(this.companyRepository, filters || {}, queryBuilder);
  }

  async findOne(id: string): Promise<Company> {
    const company = await this.companyRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!company) {
      throw new NotFoundException(`Empresa con ID ${id} no encontrada`);
    }

    return company;
  }

  async update(
    id: string,
    updateCompanyDto: UpdateCompanyDto,
  ): Promise<Company> {
    this.logger.log(
      `[UPDATE] Actualizando empresa ${id} con datos:`,
      updateCompanyDto,
    );

    const company = await this.findOne(id);
    this.logger.log(`[UPDATE] Empresa encontrada:`, {
      id: company.id,
      name: company.name,
      currentUserId: company.user?.id,
    });

    // Extraer userId del DTO si existe
    const { userId, ...restData } = updateCompanyDto;

    // Asignar el resto de los datos
    Object.assign(company, restData);

    // Si viene userId, buscar el usuario y asignar la relación
    if (userId) {
      this.logger.log(`[UPDATE] Buscando usuario con ID: ${userId}`);
      const user = await this.usersService.findOne(userId);
      this.logger.log(`[UPDATE] Usuario encontrado:`, {
        id: user.id,
        email: user.email,
      });
      company.user = user;
    }

    this.logger.log(`[UPDATE] Guardando empresa con userId:`, company.user?.id);
    const saved = await this.companyRepository.save(company);
    this.logger.log(`[UPDATE] Empresa guardada:`, {
      id: saved.id,
      userId: saved.user?.id,
    });

    return saved;
  }

  async remove(id: string): Promise<void> {
    const company = await this.findOne(id);

    // Verificar si hay procesos de selección asociados
    const processesCount = await this.processRepository.count({
      where: { company: { id } },
    });

    console.log(
      `[CompaniesService.remove] Empresa ${id}, procesos encontrados: ${processesCount}`,
    );

    if (processesCount > 0) {
      console.log(
        `[CompaniesService.remove] Lanzando BadRequestException por procesos asociados`,
      );
      throw new BadRequestException(
        `No se puede eliminar la empresa porque tiene ${processesCount} proceso(s) de selección asociado(s). Por favor, elimine o transfiera los procesos antes de eliminar la empresa.`,
      );
    }

    // Intentar eliminar la empresa
    console.log(`[CompaniesService.remove] Intentando eliminar empresa ${id}`);
    try {
      await this.companyRepository.remove(company);
      console.log(`[CompaniesService.remove] Empresa eliminada exitosamente`);
    } catch (error: unknown) {
      console.log(`[CompaniesService.remove] Error capturado:`, error);
      console.log(
        `[CompaniesService.remove] Tipo de error:`,
        error?.constructor?.name,
      );

      // Capturar cualquier error de base de datos y convertirlo en BadRequestException
      if (error instanceof QueryFailedError) {
        const pgError = error as any;
        const errorMessage = pgError.message || '';
        const errorCode = pgError.code;

        console.log(
          `[CompaniesService.remove] QueryFailedError detectado, código: ${errorCode}, mensaje: ${errorMessage}`,
        );

        // Código 23503 es foreign key constraint violation en PostgreSQL
        if (
          errorCode === '23503' ||
          errorMessage.includes('foreign key constraint')
        ) {
          // Detectar qué tabla está causando el problema
          if (errorMessage.includes('selection_processes')) {
            console.log(
              `[CompaniesService.remove] Lanzando BadRequestException por selection_processes`,
            );
            throw new BadRequestException(
              'No se puede eliminar la empresa porque tiene procesos de selección asociados. Por favor, elimine o transfiera los procesos antes de eliminar la empresa.',
            );
          } else {
            console.log(
              `[CompaniesService.remove] Lanzando BadRequestException genérico por foreign key`,
            );
            throw new BadRequestException(
              'No se puede eliminar la empresa porque tiene datos asociados. Por favor, elimine primero los datos relacionados.',
            );
          }
        }
      }

      // Si es un BadRequestException, relanzarlo tal cual
      if (error instanceof BadRequestException) {
        console.log(
          `[CompaniesService.remove] Relanzando BadRequestException existente`,
        );
        throw error;
      }

      // Para cualquier otro error, lanzar BadRequestException genérico
      console.log(
        `[CompaniesService.remove] Lanzando BadRequestException genérico para error desconocido`,
      );
      throw new BadRequestException(
        'No se puede eliminar la empresa porque tiene datos asociados. Por favor, verifique las relaciones antes de eliminar.',
      );
    }
  }

  async findByUserId(userId: string): Promise<Company | null> {
    return this.companyRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
  }> {
    const total = await this.companyRepository.count();
    const active = await this.companyRepository.count({
      where: { isActive: true },
    });
    const inactive = total - active;

    return {
      total,
      active,
      inactive,
    };
  }

  async getDashboardStats(companyId: string) {
    await this.findOne(companyId);

    const now = new Date();
    const oneMonthAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      now.getDate(),
    );
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const procesosActivos = await this.processRepository.count({
      where: {
        company: { id: companyId },
        status: ProcessStatus.ACTIVE,
      },
    });

    const procesosActivosMesAnterior = await this.processRepository.count({
      where: {
        company: { id: companyId },
        status: ProcessStatus.ACTIVE,
        createdAt: LessThan(oneMonthAgo),
      },
    });

    const procesosActivosNuevos = procesosActivos - procesosActivosMesAnterior;

    // Contar workers únicos (no duplicados)
    const candidatosTotales = await this.workerProcessRepository
      .createQueryBuilder('wp')
      .innerJoin('wp.process', 'process')
      .where('process.company_id = :companyId', { companyId })
      .select('COUNT(DISTINCT wp.worker_id)', 'count')
      .getRawOne()
      .then((result) => parseInt(result.count, 10));

    const candidatosSemanaAnterior = await this.workerProcessRepository
      .createQueryBuilder('wp')
      .innerJoin('wp.process', 'process')
      .where('process.company_id = :companyId', { companyId })
      .andWhere('wp.created_at < :oneWeekAgo', { oneWeekAgo })
      .select('COUNT(DISTINCT wp.worker_id)', 'count')
      .getRawOne()
      .then((result) => parseInt(result.count, 10));

    const candidatosNuevos = candidatosTotales - candidatosSemanaAnterior;

    const candidatosAprobados = await this.workerProcessRepository
      .createQueryBuilder('wp')
      .innerJoin('wp.process', 'process')
      .where('process.company_id = :companyId', { companyId })
      .andWhere('wp.status = :status', { status: WorkerStatus.APPROVED })
      .select('COUNT(DISTINCT wp.worker_id)', 'count')
      .getRawOne()
      .then((result) => parseInt(result.count, 10));

    const tasaAprobacion =
      candidatosTotales > 0
        ? ((candidatosAprobados / candidatosTotales) * 100).toFixed(1)
        : '0.0';

    const procesosCompletados = await this.processRepository.count({
      where: {
        company: { id: companyId },
        status: ProcessStatus.COMPLETED,
        updatedAt: MoreThan(startOfMonth),
      },
    });

    return {
      procesosActivos: {
        total: procesosActivos,
        nuevos: procesosActivosNuevos,
        texto:
          procesosActivosNuevos > 0
            ? `+${procesosActivosNuevos} desde el mes pasado`
            : procesosActivosNuevos < 0
              ? `${procesosActivosNuevos} desde el mes pasado`
              : 'Sin cambios este mes',
      },
      candidatos: {
        total: candidatosTotales,
        nuevos: candidatosNuevos,
        texto:
          candidatosNuevos > 0
            ? `+${candidatosNuevos} esta semana`
            : 'Sin nuevos esta semana',
      },
      candidatosAprobados: {
        total: candidatosAprobados,
        tasaAprobacion: `${tasaAprobacion}% tasa de aprobación`,
      },
      procesosCompletados: {
        total: procesosCompletados,
        texto: 'Este mes',
      },
    };
  }

  async uploadLogo(
    companyId: string,
    file: Express.Multer.File,
  ): Promise<Company> {
    const company = await this.findOne(companyId);

    try {
      // Delete old logo from S3 if exists
      if (company.logo && company.logo.startsWith('logos/')) {
        try {
          await this.s3Service.deleteFile(company.logo);
          this.logger.log(`Deleted old logo: ${company.logo}`);
        } catch (err) {
          this.logger.warn(
            `Could not delete old logo: ${company.logo}. ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // Upload new logo to S3
      const uploadResult = await uploadFileAndGetPublicUrl(
        this.s3Service,
        file,
        'logos',
        companyId,
      );

      this.logger.log(`Logo uploaded to S3: ${uploadResult.key}`);

      // Update company with new logo URL
      company.logo = uploadResult.url;
      return this.companyRepository.save(company);
    } catch (error) {
      this.logger.error(
        `Failed to upload logo: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException(
        'No se pudo subir el logo. Intente nuevamente.',
      );
    }
  }

  async deleteLogo(companyId: string): Promise<Company> {
    const company = await this.findOne(companyId);

    if (!company.logo) {
      throw new BadRequestException(
        'La empresa no tiene un logo para eliminar',
      );
    }

    try {
      // Delete from S3 if it's an S3 URL
      if (company.logo.startsWith('logos/')) {
        await this.s3Service.deleteFile(company.logo);
        this.logger.log(`Logo deleted from S3: ${company.logo}`);
      }

      // Clear logo field
      company.logo = null;
      return this.companyRepository.save(company);
    } catch (error) {
      this.logger.error(
        `Failed to delete logo: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException(
        'No se pudo eliminar el logo. Intente nuevamente.',
      );
    }
  }
}
