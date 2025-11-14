import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Test } from './entities/test.entity';
import { TestQuestion } from './entities/test-question.entity';
import { FixedTest } from './entities/fixed-test.entity';
import { CreateTestDto } from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class TestsService {
  constructor(
    @InjectRepository(Test)
    private readonly testRepository: Repository<Test>,
    @InjectRepository(TestQuestion)
    private readonly questionRepository: Repository<TestQuestion>,
    @InjectRepository(FixedTest)
    private readonly fixedTestRepository: Repository<FixedTest>,
    private readonly usersService: UsersService,
  ) {}

  async create(createTestDto: CreateTestDto, userId: string): Promise<Test> {
    const { questions, ...testData } = createTestDto;

    const user = await this.usersService.findOne(userId);

    const test = this.testRepository.create({
      ...testData,
      createdBy: user,
    });

    const savedTest = await this.testRepository.save(test);

    if (questions && questions.length > 0) {
      const questionEntities = questions.map((q) =>
        this.questionRepository.create({
          ...q,
          test: savedTest,
        }),
      );
      await this.questionRepository.save(questionEntities);
    }

    return this.findOne(savedTest.id);
  }

  async findAll(): Promise<Test[]> {
    return this.testRepository.find({
      relations: ['createdBy', 'questions'],
      order: {
        createdAt: 'DESC',
        questions: {
          order: 'ASC',
        },
      },
    });
  }

  async findOne(id: string): Promise<Test> {
    const test = await this.testRepository.findOne({
      where: { id },
      relations: ['createdBy', 'questions'],
      order: {
        questions: {
          order: 'ASC',
        },
      },
    });

    if (!test) {
      throw new NotFoundException(`Test con ID ${id} no encontrado`);
    }

    return test;
  }

  async findByType(type: string): Promise<Test[]> {
    return this.testRepository.find({
      where: { type: type as any, isActive: true },
      relations: ['createdBy', 'questions'],
      order: {
        createdAt: 'DESC',
        questions: {
          order: 'ASC',
        },
      },
    });
  }

  async update(id: string, updateTestDto: UpdateTestDto): Promise<Test> {
    const test = await this.findOne(id);

    const { questions, ...testData } = updateTestDto;

    Object.assign(test, testData);
    await this.testRepository.save(test);

    if (questions && questions.length > 0) {
      await this.questionRepository.delete({ test: { id } });

      const questionEntities = questions.map((q) =>
        this.questionRepository.create({
          ...q,
          test,
        }),
      );
      await this.questionRepository.save(questionEntities);
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const test = await this.findOne(id);
    await this.testRepository.remove(test);
  }

  async getQuestions(testId: string): Promise<TestQuestion[]> {
    const test = await this.findOne(testId);
    return test.questions;
  }

  async toggleActive(id: string): Promise<Test> {
    const test = await this.findOne(id);
    test.isActive = !test.isActive;
    return this.testRepository.save(test);
  }

  async findAllFixedTests(): Promise<FixedTest[]> {
    return this.fixedTestRepository.find({
      where: { isActive: true },
      order: { orderIndex: 'ASC' },
    });
  }

  async findOneFixedTest(id: string): Promise<FixedTest> {
    const fixedTest = await this.fixedTestRepository.findOne({
      where: { id },
    });

    if (!fixedTest) {
      throw new NotFoundException(`Test fijo con ID ${id} no encontrado`);
    }

    return fixedTest;
  }
}
