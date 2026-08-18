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
import {
  borrarProcesosEnCascada,
  contarImpacto,
  ImpactoBorrado,
} from '../../common/helpers/borrado-en-cascada.helper';
import { S3Service } from '../../common/services/s3.service';
import { uploadFileAndGetPublicUrl } from '../../common/helpers/s3.helper';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationType } from '../../common/enums/notification-type.enum';
import {
  isValidRut,
  normalizeRut,
  stripRut,
} from '../../common/helpers/rut.helper';

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
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async create(createCompanyDto: CreateCompanyDto): Promise<Company> {
    const { userId, ...companyData } = createCompanyDto;

    // Validar y normalizar el RUT antes de comparar y guardar
    if (!isValidRut(companyData.rut)) {
      throw new BadRequestException(
        'El RUT ingresado no es válido. Verifique el número y el dígito verificador.',
      );
    }
    companyData.rut = normalizeRut(companyData.rut);

    // La comparación ignora puntos y guión para detectar el mismo RUT escrito
    // en distinto formato, incluso en registros antiguos sin normalizar.
    const existingCompany = await this.companyRepository
      .createQueryBuilder('company')
      .where(
        "REPLACE(REPLACE(UPPER(company.rut), '.', ''), '-', '') = :bareRut",
        { bareRut: stripRut(companyData.rut) },
      )
      .getOne();

    if (existingCompany) {
      throw new ConflictException(
        `El RUT ya está registrado por la empresa "${existingCompany.name}"`,
      );
    }

    // Solo buscar usuario si se proporciona userId
    // Un usuario puede representar a varias empresas, asi que no hay nada que
    // verificar mas alla de que exista.
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

    const savedCompany = await this.companyRepository.save(company);

    // Notificar a todos los administradores sobre la nueva empresa
    try {
      const admins = await this.usersService.findAdminUsers();
      const adminIds = admins.map((admin) => admin.id);

      if (adminIds.length > 0) {
        await this.notificationsGateway.broadcastNotification(adminIds, {
          title: 'Nueva empresa registrada',
          message: `La empresa "${savedCompany.name}" se ha registrado en la plataforma`,
          type: NotificationType.INFO,
          link: `/admin/empresas/${savedCompany.id}`,
        });
      }
    } catch (error) {
      this.logger.error(
        `Error sending notification for new company: ${error instanceof Error ? error.message : String(error)}`,
      );
      // No lanzar error para no bloquear la creación de la empresa
    }

    return savedCompany;
  }

  async findAll(filters?: CompanyFilterDto): Promise<PaginatedResult<Company>> {
    const queryBuilder = this.companyRepository
      .createQueryBuilder('company')
      .leftJoinAndSelect('company.user', 'user');

    if (filters?.active !== undefined) {
      queryBuilder.andWhere('company.isActive = :active', {
        active: filters.active,
      });
    }

    if (filters?.search) {
      queryBuilder.andWhere(
        // P-37: unaccent en los campos de texto. El RUT queda fuera a
        // propósito: no lleva acentos y ya se normaliza al guardarse.
        `(unaccent(company.name) ILIKE unaccent(:search)
          OR company.rut ILIKE :search
          OR unaccent(company.industry) ILIKE unaccent(:search)
          OR unaccent(company.city) ILIKE unaccent(:search)
          OR unaccent(user.email) ILIKE unaccent(:search))`,
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

    /**
     * Representante. Los tres casos son distintos y antes se confundian dos:
     * `if (userId)` trataba igual "no lo mandes" que "dejalo sin nadie", asi
     * que no habia forma de desvincular y el usuario quedaba pegado a la
     * empresa para siempre.
     */
    if (userId === null) {
      this.logger.log(`[UPDATE] Desvinculando representante de la empresa`);
      company.user = null;
    } else if (userId) {
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

  /** Qué se destruiría al eliminar esta empresa. Solo cuenta, no modifica nada. */
  async impactoDeBorrado(id: string): Promise<ImpactoBorrado> {
    await this.findOne(id);
    const procesos = await this.processRepository.find({
      where: { company: { id } },
      select: ['id'],
    });
    return contarImpacto(
      this.companyRepository.manager,
      procesos.map((p) => p.id),
    );
  }

  /**
   * Elimina la empresa con TODOS sus procesos y lo que cuelga de ellos.
   *
   * Antes esto se bloqueaba con un mensaje que pedía "eliminar o transferir los
   * procesos antes de eliminar la empresa". El problema: eliminar esos procesos
   * TAMPOCO se podía —fallaban por clave foránea en cuanto tenían un postulante,
   * una invitación o un informe—, así que la empresa quedaba imposible de borrar
   * y el mensaje mandaba a hacer algo que no se podía hacer.
   *
   * Es DESTRUCTIVO e irreversible: se van las postulaciones, las respuestas de
   * los tests y los informes psicotécnicos de personas reales. La pantalla debe
   * mostrar `impactoDeBorrado()` antes de pedir la confirmación.
   *
   * Las cuentas de usuario NO se eliminan: el representante y los invitados solo
   * dejan de apuntar a la empresa. Son personas, no datos de la empresa.
   */
  async remove(id: string): Promise<void> {
    const company = await this.findOne(id);

    const procesos = await this.processRepository.find({
      where: { company: { id } },
      select: ['id'],
    });

    await this.companyRepository.manager.transaction(async (em) => {
      await borrarProcesosEnCascada(
        em,
        procesos.map((p) => p.id),
      );

      // Las invitaciones a la empresa no cuelgan de ningún proceso.
      await em.query('DELETE FROM invitations WHERE company_id = $1', [id]);

      // Desvincular a las personas, sin borrarlas.
      await em.query(
        'UPDATE users SET company_id = NULL WHERE company_id = $1',
        [id],
      );

      await em.query('DELETE FROM companies WHERE id = $1', [id]);
    });

    this.logger.log(
      `Empresa "${company.name}" eliminada con ${procesos.length} proceso(s) y sus datos asociados`,
    );
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

    // P-39. El panel de Empresa mostraba SIEMPRE 0 postulantes en cada proceso
    // y la actividad reciente siempre vacía, porque el frontend leía
    // `proceso.workers` y el listado de procesos no trae esa relación.
    //
    // Se resuelve devolviendo los contadores ya calculados, en vez de mandar la
    // nómina completa de candidatos solo para contarla: es más rápido y, sobre
    // todo, no expone datos personales donde no hacen falta (ver P-22).
    const detallePorProceso = await this.processRepository
      .createQueryBuilder('process')
      // La entidad SelectionProcess no declara la relación inversa hacia
      // WorkerProcess, así que el join va con la condición explícita. Es LEFT
      // a propósito: un proceso sin ningún postulante tiene que salir igual,
      // con el contador en 0.
      .leftJoin(WorkerProcess, 'wp', 'wp.process_id = process.id')
      .where('process.company_id = :companyId', { companyId })
      .andWhere('process.status = :status', { status: ProcessStatus.ACTIVE })
      .select('process.id', 'id')
      .addSelect('process.name', 'titulo')
      .addSelect('process.endDate', 'fechaVencimiento')
      .addSelect('COUNT(wp.id)', 'postulantes')
      .addSelect(
        `COUNT(wp.id) FILTER (WHERE wp.status = '${WorkerStatus.IN_PROCESS}')`,
        'enEvaluacion',
      )
      .addSelect(
        `COUNT(wp.id) FILTER (WHERE wp.status = '${WorkerStatus.APPROVED}')`,
        'aprobados',
      )
      .groupBy('process.id')
      .orderBy('process.createdAt', 'DESC')
      .getRawMany()
      .then((filas) =>
        filas.map((f) => ({
          id: f.id,
          titulo: f.titulo,
          fechaVencimiento: f.fechaVencimiento,
          postulantes: parseInt(f.postulantes, 10) || 0,
          enEvaluacion: parseInt(f.enEvaluacion, 10) || 0,
          aprobados: parseInt(f.aprobados, 10) || 0,
        })),
      );

    // Solo las 5 últimas: es lo que el panel muestra.
    const actividadReciente = await this.workerProcessRepository
      .createQueryBuilder('wp')
      .innerJoin('wp.process', 'process')
      .innerJoin('wp.worker', 'worker')
      .where('process.company_id = :companyId', { companyId })
      .select('wp.id', 'id')
      .addSelect('worker.firstName', 'firstName')
      .addSelect('worker.lastName', 'lastName')
      .addSelect('process.name', 'proceso')
      .addSelect('wp.appliedAt', 'appliedAt')
      .orderBy('wp.created_at', 'DESC')
      .limit(5)
      .getRawMany()
      .then((filas) =>
        filas.map((f) => ({
          id: f.id,
          tipo: 'nuevo_postulante',
          nombre:
            `${f.firstName ?? ''} ${f.lastName ?? ''}`.trim() || 'Candidato',
          proceso: f.proceso,
          appliedAt: f.appliedAt,
        })),
      );

    return {
      procesosActivosDetalle: detallePorProceso,
      actividadReciente,
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
