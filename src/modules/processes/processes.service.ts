import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SelectionProcess } from './entities/selection-process.entity';
import { CreateProcessDto } from './dto/create-process.dto';
import {
  UpdateProcessDto,
  AssignEvaluatorsDto,
} from './dto/update-process.dto';
import { ProcessFilterDto } from './dto/process-filter.dto';
import { CompaniesService } from '../companies/companies.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { ProcessStatus } from '../../common/enums/process-status.enum';
import { paginate } from '../../common/helpers/pagination.helper';
import {
  assertBelongsToUserCompany,
  isCompanyScopedRole,
  resolveUserCompanyId,
  NO_COMPANY,
} from '../../common/helpers/ownership.helper';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import {
  borrarProcesosEnCascada,
  contarImpacto,
  ImpactoBorrado,
} from '../../common/helpers/borrado-en-cascada.helper';
import { Test } from '../tests/entities/test.entity';
import { FixedTest } from '../tests/entities/fixed-test.entity';
import { WorkerProcess } from '../workers/entities/worker-process.entity';
import { TestResponse } from '../test-responses/entities/test-response.entity';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { Logger } from '@nestjs/common';

@Injectable()
export class ProcessesService {
  private readonly logger = new Logger(ProcessesService.name);

  constructor(
    @InjectRepository(SelectionProcess)
    private readonly processRepository: Repository<SelectionProcess>,
    @InjectRepository(Test)
    private readonly testRepository: Repository<Test>,
    @InjectRepository(FixedTest)
    private readonly fixedTestRepository: Repository<FixedTest>,
    @InjectRepository(WorkerProcess)
    private readonly workerProcessRepository: Repository<WorkerProcess>,
    private readonly companiesService: CompaniesService,
    private readonly usersService: UsersService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async create(
    createProcessDto: CreateProcessDto,
    userId: string,
  ): Promise<SelectionProcess> {
    const { companyId, ...processData } = createProcessDto;

    const company = await this.companiesService.findOne(companyId);

    const user = await this.usersService.findOne(userId);

    const existingProcess = await this.processRepository.findOne({
      where: { code: processData.code },
    });

    if (existingProcess) {
      throw new ConflictException('El código del proceso ya está registrado');
    }

    const process = this.processRepository.create({
      ...processData,
      company,
      createdBy: user,
    });

    const savedProcess = await this.processRepository.save(process);

    // Notificar a todos los administradores sobre el nuevo proceso
    try {
      const admins = await this.usersService.findAdminUsers();
      const adminIds = admins.map((admin) => admin.id);

      if (adminIds.length > 0) {
        await this.notificationsGateway.broadcastNotification(adminIds, {
          title: 'Nuevo proceso creado',
          message: `Se ha creado el proceso "${savedProcess.name}" para ${company.name}`,
          type: NotificationType.PROCESS_UPDATE,
          link: `/admin/procesos/${savedProcess.id}`,
        });
      }
    } catch (error) {
      this.logger.error(
        `Error sending notification for new process: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return savedProcess;
  }

  async findAll(
    filters?: ProcessFilterDto,
    requester?: any,
  ): Promise<PaginatedResult<SelectionProcess>> {
    const queryBuilder = this.processRepository
      .createQueryBuilder('process')
      .leftJoinAndSelect('process.company', 'company')
      .leftJoinAndSelect('process.createdBy', 'createdBy')
      .leftJoinAndSelect('process.evaluators', 'evaluators');

    if (filters?.status) {
      queryBuilder.andWhere('process.status = :status', {
        status: filters.status,
      });
    }

    // P-22. El recorte por empresa se decide en el SERVIDOR a partir de la
    // sesion, no del filtro que manda el navegador. Antes companyId venia solo
    // del querystring: bastaba con no enviarlo, o enviar el de otra empresa,
    // para listar los procesos de la competencia.
    const scopedCompanyId = this.companyScopeFor(requester);

    if (scopedCompanyId) {
      queryBuilder.andWhere('company.id = :scopedCompanyId', {
        scopedCompanyId,
      });
    } else if (filters?.companyId) {
      queryBuilder.andWhere('company.id = :companyId', {
        companyId: filters.companyId,
      });
    }

    if (filters?.evaluatorId) {
      queryBuilder.andWhere('evaluators.id = :evaluatorId', {
        evaluatorId: filters.evaluatorId,
      });
    }

    if (filters?.search) {
      queryBuilder.andWhere(
        // P-37: la búsqueda ignora acentos y ñ.
        `(unaccent(process.name) ILIKE unaccent(:search)
          OR unaccent(process.position) ILIKE unaccent(:search)
          OR unaccent(process.description) ILIKE unaccent(:search)
          OR process.code ILIKE :search)`,
        { search: `%${filters.search}%` },
      );
    }

    queryBuilder.orderBy('process.createdAt', 'DESC');

    return paginate(this.processRepository, filters || {}, queryBuilder);
  }

  async findPublicProcesses(
    filters?: ProcessFilterDto,
  ): Promise<PaginatedResult<SelectionProcess>> {
    const queryBuilder = this.processRepository
      .createQueryBuilder('process')
      .leftJoinAndSelect('process.company', 'company')
      .where('process.status = :status', { status: ProcessStatus.ACTIVE });

    if (filters?.search) {
      queryBuilder.andWhere(
        `(unaccent(process.name) ILIKE unaccent(:search)
          OR unaccent(process.position) ILIKE unaccent(:search)
          OR unaccent(process.description) ILIKE unaccent(:search))`,
        { search: `%${filters.search}%` },
      );
    }

    queryBuilder.orderBy('process.createdAt', 'DESC');

    return paginate(this.processRepository, filters || {}, queryBuilder);
  }

  async findByCompany(companyId: string): Promise<SelectionProcess[]> {
    return this.processRepository.find({
      where: { company: { id: companyId } },
      relations: ['company', 'createdBy', 'evaluators'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, requester?: any): Promise<SelectionProcess> {
    const process = await this.processRepository.findOne({
      where: { id },
      relations: ['company', 'createdBy', 'evaluators'],
    });

    if (!process) {
      throw new NotFoundException(`Proceso con ID ${id} no encontrado`);
    }

    // Ocultarlo del listado no basta: con el id a mano se entraba igual.
    if (requester) {
      assertBelongsToUserCompany(
        requester,
        process.company?.id,
        'este proceso',
      );
    }

    return process;
  }

  /**
   * Devuelve la empresa a la que hay que acotar la consulta, o null si quien
   * pregunta no esta acotado a ninguna (Talentree, evaluador, candidato).
   *
   * NOTA PENDIENTE DE DEFINICION (caso EVA-01): hoy el evaluador ve todos los
   * procesos. Si la clienta confirma que debe ver solo los asignados, el
   * recorte va aqui, filtrando por process.evaluators.
   */
  private companyScopeFor(requester?: any): string | null {
    if (!requester) return null;
    if (!isCompanyScopedRole(requester.role)) return null;

    // Sin empresa asignada no se lista nada, en vez de listarse todo.
    return resolveUserCompanyId(requester) ?? NO_COMPANY;
  }

  async update(
    id: string,
    updateProcessDto: UpdateProcessDto,
  ): Promise<SelectionProcess> {
    const process = await this.findOne(id);
    const oldStatus = process.status;

    // P-25. El DTO de edicion no incluye startDate, asi que la regla cruzada
    // del decorador no tiene con que comparar: aqui se contrasta la fecha de
    // termino nueva contra la de inicio YA GUARDADA.
    if (updateProcessDto.endDate && process.startDate) {
      const inicio = new Date(process.startDate as any).getTime();
      const termino = new Date(updateProcessDto.endDate).getTime();

      if (!Number.isNaN(inicio) && !Number.isNaN(termino) && termino < inicio) {
        throw new BadRequestException(
          'La fecha de término no puede ser anterior a la fecha de inicio del proceso.',
        );
      }
    }

    Object.assign(process, updateProcessDto);
    const savedProcess = await this.processRepository.save(process);

    // Notificar si el estado cambió
    if (updateProcessDto.status && oldStatus !== updateProcessDto.status) {
      try {
        const companyUsers = await this.usersService.findCompanyUsers(
          process.company.id
        );
        const companyUserIds = companyUsers.map((user) => user.id);

        const statusLabels = {
          [ProcessStatus.DRAFT]: 'Borrador',
          [ProcessStatus.ACTIVE]: 'Activo',
          [ProcessStatus.PAUSED]: 'Pausado',
          [ProcessStatus.COMPLETED]: 'Completado',
          [ProcessStatus.CLOSED]: 'Cerrado',
        };

        if (companyUserIds.length > 0) {
          await this.notificationsGateway.broadcastNotification(companyUserIds, {
            title: 'Cambio de estado en proceso',
            message: `El proceso "${process.name}" cambió de estado a "${statusLabels[updateProcessDto.status]}"`,
            type: NotificationType.PROCESS_UPDATE,
            link: `/empresa/procesos/${process.id}`,
          });
        }

        // Notificar a todos los trabajadores cuando un proceso se activa
        if (updateProcessDto.status === ProcessStatus.ACTIVE) {
          const workers = await this.usersService.findByRole(UserRole.WORKER);
          const workerIds = workers.filter(w => w.isActive).map((worker) => worker.id);

          if (workerIds.length > 0) {
            await this.notificationsGateway.broadcastNotification(workerIds, {
              title: 'Nueva oferta disponible',
              message: `El proceso "${savedProcess.name}" está ahora disponible para postulaciones`,
              type: NotificationType.INFO,
              // P-68: aqui el candidato todavia no postulo, asi que no hay postulacion
              // a la que enlazar: se lleva al listado de ofertas, que si existe.
              link: `/trabajador/procesos`,
            });
          }
        }
      } catch (error) {
        this.logger.error(
          `Error sending notification for process status change: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return savedProcess;
  }

  /** Qué se destruiría al eliminar este proceso. Solo cuenta, no modifica nada. */
  async impactoDeBorrado(id: string): Promise<ImpactoBorrado> {
    await this.findOne(id);
    return contarImpacto(this.processRepository.manager, [id]);
  }

  /**
   * Elimina el proceso y todo lo que cuelga de él.
   *
   * Antes era un `repository.remove()` pelado, que fallaba con violación de
   * clave foránea en cuanto el proceso tenía un solo postulante, una invitación
   * o un informe: en la práctica, cualquier proceso con actividad real era
   * imposible de borrar. Ahora se borra la cadena completa en una transacción.
   *
   * Es IRREVERSIBLE: se lleva las postulaciones, las respuestas de los tests y
   * los informes. Usar `impactoDeBorrado()` para advertirlo antes de confirmar.
   */
  async remove(id: string): Promise<void> {
    await this.findOne(id);

    await this.processRepository.manager.transaction(async (em) => {
      await borrarProcesosEnCascada(em, [id]);
    });

    this.logger.log(`Proceso ${id} eliminado junto con sus datos asociados`);
  }

  async assignEvaluators(
    id: string,
    assignEvaluatorsDto: AssignEvaluatorsDto,
  ): Promise<SelectionProcess> {
    const process = await this.findOne(id);

    const validEvaluators = [];
    for (const evaluatorId of assignEvaluatorsDto.evaluatorIds) {
      const user = await this.usersService.findOne(evaluatorId);
      if (user.role !== UserRole.EVALUATOR) {
        throw new ConflictException(
          `El usuario ${user.email} no tiene rol de evaluador, así que no se puede asignar al proceso.`,
        );
      }
      validEvaluators.push(user);
    }

    process.evaluators = validEvaluators;
    const savedProcess = await this.processRepository.save(process);

    // Notificar a los evaluadores asignados
    if (validEvaluators.length > 0) {
      try {
        const evaluatorIds = validEvaluators.map((evaluator) => evaluator.id);

        await this.notificationsGateway.broadcastNotification(evaluatorIds, {
          title: 'Asignado a nuevo proceso',
          message: `Has sido asignado como evaluador del proceso "${savedProcess.name}"`,
          type: NotificationType.TEST_ASSIGNED,
          link: `/evaluador/procesos/${savedProcess.id}`,
        });
      } catch (error) {
        this.logger.error(
          `Error sending notification to assigned evaluators: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return savedProcess;
  }

  async getEvaluators(id: string): Promise<User[]> {
    const process = await this.findOne(id);
    return process.evaluators || [];
  }

  async getTests(
    id: string,
    user?: any,
  ): Promise<{ tests: any[]; fixedTests: any[] }> {
    const process = await this.processRepository.findOne({
      where: { id },
      relations: ['tests', 'tests.questions', 'fixedTests'],
    });

    if (!process) {
      throw new NotFoundException(`Proceso con ID ${id} no encontrado`);
    }

    // If user is a worker, find their test responses for this process
    let testResponses: TestResponse[] = [];
    console.log('🔍 User role:', user?.role, 'Worker ID:', user?.worker?.id);

    if (user && user.role === UserRole.WORKER && user.worker?.id) {
      console.log('✅ Looking for WorkerProcess for worker:', user.worker.id, 'process:', id);

      const workerProcess = await this.workerProcessRepository.findOne({
        where: {
          worker: { id: user.worker.id },
          process: { id },
        },
        relations: ['testResponses', 'testResponses.test', 'testResponses.fixedTest'],
      });

      console.log('📦 Found WorkerProcess:', workerProcess?.id, 'TestResponses:', workerProcess?.testResponses?.length);

      if (workerProcess && workerProcess.testResponses) {
        testResponses = workerProcess.testResponses;
        console.log('📝 Test responses:', testResponses.map(tr => ({
          id: tr.id,
          testId: tr.test?.id,
          fixedTestId: tr.fixedTest?.id,
          status: tr.status
        })));
      }
    } else {
      console.log('⚠️ Not a worker or missing worker.id');
    }

    // Add status to each test
    const testsWithStatus = (process.tests || []).map((test) => {
      const response = testResponses.find((tr) => tr.test?.id === test.id);
      if (!response) {
        return { ...test, testStatus: 'available' };
      }
      // If status is null, test is in progress (started but not submitted)
      if (!response.status) {
        return { ...test, testStatus: 'in_progress' };
      }
      // If status is 'completed', test was completed successfully
      if (response.status === 'completed') {
        return { ...test, testStatus: 'completed' };
      }
      // Otherwise (insufficient_answers, abandoned), mark as incomplete
      return { ...test, testStatus: 'incomplete' };
    });

    // Add status to each fixed test
    const fixedTestsWithStatus = (process.fixedTests || []).map((fixedTest) => {
      const response = testResponses.find((tr) => tr.fixedTest?.id === fixedTest.id);
      if (!response) {
        return { ...fixedTest, testStatus: 'available' };
      }
      // If status is null, test is in progress (started but not submitted)
      if (!response.status) {
        return { ...fixedTest, testStatus: 'in_progress' };
      }
      // If status is 'completed', test was completed successfully
      if (response.status === 'completed') {
        return { ...fixedTest, testStatus: 'completed' };
      }
      // Otherwise (insufficient_answers, abandoned), mark as incomplete
      return { ...fixedTest, testStatus: 'incomplete' };
    });

    return {
      tests: testsWithStatus,
      fixedTests: fixedTestsWithStatus,
    };
  }

  async addTest(processId: string, testId: string): Promise<SelectionProcess> {
    const process = await this.processRepository.findOne({
      where: { id: processId },
      relations: ['tests'],
    });

    if (!process) {
      throw new NotFoundException(
        `Proceso con ID ${processId} no encontrado`,
      );
    }

    const test = await this.testRepository.findOne({
      where: { id: testId },
      relations: ['questions'],
    });

    if (!test) {
      throw new NotFoundException(`Test con ID ${testId} no encontrado`);
    }

    // P-50. Un test sin preguntas asignado a un proceso deja al candidato
    // frente a una evaluacion vacia, sin nada que responder y sin poder
    // avanzar. Se corta aqui, que es donde el dano se vuelve visible.
    if (!test.questions || test.questions.length === 0) {
      throw new BadRequestException(
        `El test "${test.name}" no tiene preguntas, así que no se puede asignar a un proceso. Agregale preguntas primero.`,
      );
    }

    // Check if test is already assigned
    const isAlreadyAssigned = process.tests.some((t) => t.id === testId);
    if (isAlreadyAssigned) {
      throw new BadRequestException('El test ya está asignado a este proceso');
    }

    process.tests.push(test);
    return this.processRepository.save(process);
  }

  async removeTest(
    processId: string,
    testId: string,
  ): Promise<SelectionProcess> {
    const process = await this.processRepository.findOne({
      where: { id: processId },
      relations: ['tests'],
    });

    if (!process) {
      throw new NotFoundException(
        `Proceso con ID ${processId} no encontrado`,
      );
    }

    process.tests = process.tests.filter((test) => test.id !== testId);
    return this.processRepository.save(process);
  }

  async addFixedTest(
    processId: string,
    fixedTestId: string,
  ): Promise<SelectionProcess> {
    const process = await this.processRepository.findOne({
      where: { id: processId },
      relations: ['fixedTests'],
    });

    if (!process) {
      throw new NotFoundException(
        `Proceso con ID ${processId} no encontrado`,
      );
    }

    const fixedTest = await this.fixedTestRepository.findOne({
      where: { id: fixedTestId },
    });

    if (!fixedTest) {
      throw new NotFoundException(
        `Test fijo con ID ${fixedTestId} no encontrado`,
      );
    }

    // Check if fixed test is already assigned
    const isAlreadyAssigned = process.fixedTests.some(
      (t) => t.id === fixedTestId,
    );
    if (isAlreadyAssigned) {
      throw new BadRequestException(
        'El test fijo ya está asignado a este proceso',
      );
    }

    process.fixedTests.push(fixedTest);
    return this.processRepository.save(process);
  }

  async removeFixedTest(
    processId: string,
    fixedTestId: string,
  ): Promise<SelectionProcess> {
    const process = await this.processRepository.findOne({
      where: { id: processId },
      relations: ['fixedTests'],
    });

    if (!process) {
      throw new NotFoundException(
        `Proceso con ID ${processId} no encontrado`,
      );
    }

    process.fixedTests = process.fixedTests.filter(
      (test) => test.id !== fixedTestId,
    );
    return this.processRepository.save(process);
  }

  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byMonth: Array<{ month: string; count: number }>;
  }> {
    const total = await this.processRepository.count();

    const byStatus: Record<string, number> = {};
    for (const status of Object.values(ProcessStatus)) {
      byStatus[status] = await this.processRepository.count({
        where: { status },
      });
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const processes = await this.processRepository
      .createQueryBuilder('process')
      .select("DATE_TRUNC('month', process.created_at)", 'month')
      .addSelect('COUNT(*)', 'count')
      .where('process.created_at >= :startDate', { startDate: sixMonthsAgo })
      .groupBy("DATE_TRUNC('month', process.created_at)")
      .orderBy('month', 'ASC')
      .getRawMany();

    const byMonth = processes.map((p) => ({
      month: new Date(p.month).toLocaleDateString('es-ES', {
        month: 'long',
        year: 'numeric',
      }),
      count: parseInt(p.count),
    }));

    return {
      total,
      byStatus,
      byMonth,
    };
  }
}
