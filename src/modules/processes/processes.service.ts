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
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { Test } from '../tests/entities/test.entity';
import { FixedTest } from '../tests/entities/fixed-test.entity';

@Injectable()
export class ProcessesService {
  constructor(
    @InjectRepository(SelectionProcess)
    private readonly processRepository: Repository<SelectionProcess>,
    @InjectRepository(Test)
    private readonly testRepository: Repository<Test>,
    @InjectRepository(FixedTest)
    private readonly fixedTestRepository: Repository<FixedTest>,
    private readonly companiesService: CompaniesService,
    private readonly usersService: UsersService,
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

    return this.processRepository.save(process);
  }

  async findAll(
    filters?: ProcessFilterDto,
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

    if (filters?.companyId) {
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
        '(process.name ILIKE :search OR process.position ILIKE :search OR process.description ILIKE :search OR process.code ILIKE :search)',
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
        '(process.name ILIKE :search OR process.position ILIKE :search OR process.description ILIKE :search)',
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

  async findOne(id: string): Promise<SelectionProcess> {
    const process = await this.processRepository.findOne({
      where: { id },
      relations: ['company', 'createdBy', 'evaluators'],
    });

    if (!process) {
      throw new NotFoundException(`Proceso con ID ${id} no encontrado`);
    }

    return process;
  }

  async update(
    id: string,
    updateProcessDto: UpdateProcessDto,
  ): Promise<SelectionProcess> {
    const process = await this.findOne(id);
    Object.assign(process, updateProcessDto);
    return this.processRepository.save(process);
  }

  async remove(id: string): Promise<void> {
    const process = await this.findOne(id);
    await this.processRepository.remove(process);
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
          `Usuario ${user.email} no es un evaluador válido`,
        );
      }
      validEvaluators.push(user);
    }

    process.evaluators = validEvaluators;
    return this.processRepository.save(process);
  }

  async getEvaluators(id: string): Promise<User[]> {
    const process = await this.findOne(id);
    return process.evaluators || [];
  }

  async getTests(id: string): Promise<{ tests: any[]; fixedTests: any[] }> {
    const process = await this.processRepository.findOne({
      where: { id },
      relations: ['tests', 'tests.questions', 'fixedTests'],
    });

    if (!process) {
      throw new NotFoundException(`Proceso con ID ${id} no encontrado`);
    }

    return {
      tests: process.tests || [],
      fixedTests: process.fixedTests || [],
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

    const test = await this.testRepository.findOne({ where: { id: testId } });

    if (!test) {
      throw new NotFoundException(`Test con ID ${testId} no encontrado`);
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
