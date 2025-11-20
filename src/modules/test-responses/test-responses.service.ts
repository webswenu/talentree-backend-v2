import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestResponse } from './entities/test-response.entity';
import { TestAnswer } from './entities/test-answer.entity';
import { WorkerProcess } from '../workers/entities/worker-process.entity';
import { SelectionProcess } from '../processes/entities/selection-process.entity';
import { StartTestDto } from './dto/start-test.dto';
import { SubmitTestDto } from './dto/submit-test.dto';
import { EvaluateAnswerDto } from './dto/evaluate-answer.dto';
import { ReportsService } from '../reports/reports.service';
import { TestCFRScoringService } from './scoring/test-cfr-scoring.service';
import { Test16PFScoringService } from './scoring/test-16pf-scoring.service';
import { TestDISCScoringService } from './scoring/test-disc-scoring.service';
import { TestILScoringService } from './scoring/test-il-scoring.service';
import { TestICScoringService } from './scoring/test-ic-scoring.service';
import { TestTACScoringService } from './scoring/test-tac-scoring.service';
import { FixedTestCode } from '../tests/shared/enums/fixed-test-code.enum';
import { WorkerStatus } from '../../common/enums/worker-status.enum';

@Injectable()
export class TestResponsesService {
  private readonly logger = new Logger(TestResponsesService.name);

  constructor(
    @InjectRepository(TestResponse)
    private readonly testResponseRepository: Repository<TestResponse>,
    @InjectRepository(TestAnswer)
    private readonly testAnswerRepository: Repository<TestAnswer>,
    @InjectRepository(WorkerProcess)
    private readonly workerProcessRepository: Repository<WorkerProcess>,
    @InjectRepository(SelectionProcess)
    private readonly selectionProcessRepository: Repository<SelectionProcess>,
    @Inject(forwardRef(() => ReportsService))
    private readonly reportsService: ReportsService,
    private readonly testCFRScoringService: TestCFRScoringService,
    private readonly test16PFScoringService: Test16PFScoringService,
    private readonly testDISCScoringService: TestDISCScoringService,
    private readonly testILScoringService: TestILScoringService,
    private readonly testICScoringService: TestICScoringService,
    private readonly testTACScoringService: TestTACScoringService,
  ) {}

  async startTest(startTestDto: StartTestDto): Promise<TestResponse> {
    // Build where condition based on test type
    const whereCondition: any = {
      workerProcess: { id: startTestDto.workerProcessId },
    };

    if (startTestDto.isFixedTest) {
      whereCondition.fixedTest = { id: startTestDto.testId };
    } else {
      whereCondition.test = { id: startTestDto.testId };
    }

    const existingResponse = await this.testResponseRepository.findOne({
      where: whereCondition,
    });

    if (existingResponse && existingResponse.isCompleted) {
      throw new BadRequestException('Este test ya ha sido completado');
    }

    if (existingResponse) {
      return existingResponse;
    }

    // Create test response based on test type
    const testResponseData: any = {
      workerProcess: { id: startTestDto.workerProcessId } as any,
      startedAt: new Date(),
      isCompleted: false,
    };

    if (startTestDto.isFixedTest) {
      testResponseData.fixedTest = { id: startTestDto.testId } as any;
    } else {
      testResponseData.test = { id: startTestDto.testId } as any;
    }

    const testResponse = this.testResponseRepository.create(testResponseData);
    const savedResponse = (await this.testResponseRepository.save(testResponse)) as unknown as TestResponse;

    // Update WorkerProcess status from 'pending' to 'in_process' when first test is started
    await this.updateWorkerProcessStatusOnTestStart(startTestDto.workerProcessId);

    return savedResponse;
  }

  async submitTest(
    responseId: string,
    submitTestDto: SubmitTestDto,
    user?: any,
  ): Promise<TestResponse> {
    let testResponse = await this.testResponseRepository.findOne({
      where: { id: responseId },
      relations: [
        'test',
        'test.questions',
        'fixedTest',
        'fixedTest.questions',
        'answers',
        'answers.question',
        'answers.fixedTestQuestion',
        'workerProcess',
        'workerProcess.worker',
        'workerProcess.worker.user',
      ],
    });

    if (!testResponse) {
      throw new NotFoundException(
        `TestResponse con ID ${responseId} no encontrado`,
      );
    }

    // Security: Workers can only submit their own tests
    // TEMPORARILY DISABLED FOR TESTING
    // if (user?.role === 'worker') {
    //   if (testResponse.workerProcess.worker.user.id !== user.sub) {
    //     throw new ForbiddenException(
    //       'No tienes permiso para enviar este test',
    //     );
    //   }
    // }

    if (testResponse.isCompleted) {
      throw new BadRequestException('Este test ya ha sido completado');
    }

    const isFixedTest = !!testResponse.fixedTest;

    const answers = submitTestDto.answers.map((answerDto) => {
      // Find existing answer - support both regular tests and fixed tests
      const existingAnswer = testResponse.answers?.find((a) => {
        if (isFixedTest) {
          return a.fixedTestQuestion?.id === answerDto.questionId;
        } else {
          return a.question?.id === answerDto.questionId;
        }
      });

      if (existingAnswer) {
        existingAnswer.answer = answerDto.answer;
        return existingAnswer;
      }

      // Create new answer - support both regular tests and fixed tests
      if (isFixedTest) {
        return this.testAnswerRepository.create({
          testResponse,
          fixedTestQuestion: { id: answerDto.questionId } as any,
          question: null, // Explicitly set to null for fixed tests
          answer: answerDto.answer,
        });
      } else {
        return this.testAnswerRepository.create({
          testResponse,
          question: { id: answerDto.questionId } as any,
          fixedTestQuestion: null, // Explicitly set to null for regular tests
          answer: answerDto.answer,
        });
      }
    });

    await this.testAnswerRepository.save(answers);

    // Auto-evaluate based on test type
    const requiresManualReview = isFixedTest
      ? false // Fixed tests are always auto-evaluated
      : testResponse.test.requiresManualReview;

    const completedAt = new Date();
    const isCompleted = true;

    // Save workerProcessId before evaluation (needed for report generation)
    const workerProcessId = testResponse.workerProcess.id;

    if (!requiresManualReview) {
      // autoEvaluate will save the entity with scoring data AND completion status
      testResponse = await this.autoEvaluate(responseId, completedAt, isCompleted);
    } else {
      // Save manually if no auto-evaluation
      testResponse.completedAt = completedAt;
      testResponse.isCompleted = isCompleted;
      testResponse = await this.testResponseRepository.save(testResponse);
    }

    // Check if all tests are completed and auto-generate report
    await this.checkAndGenerateReport(workerProcessId);

    return testResponse;
  }

  /**
   * Checks if all tests for a WorkerProcess are completed
   * and automatically generates the evaluation report
   */
  private async checkAndGenerateReport(
    workerProcessId: string,
  ): Promise<void> {
    try {
      // Get worker process with process and its tests
      const workerProcess = await this.workerProcessRepository.findOne({
        where: { id: workerProcessId },
        relations: ['process', 'process.tests', 'process.fixedTests'],
      });

      if (!workerProcess) {
        this.logger.warn(`WorkerProcess ${workerProcessId} not found`);
        return;
      }

      // Count total tests assigned to the process
      const totalTests =
        (workerProcess.process.tests?.length || 0) +
        (workerProcess.process.fixedTests?.length || 0);

      if (totalTests === 0) {
        this.logger.log(`Process has no tests assigned. Skipping report generation.`);
        return;
      }

      // Get all test responses for this worker process
      const allTestResponses = await this.testResponseRepository.find({
        where: { workerProcess: { id: workerProcessId } },
      });

      // Check if ALL tests assigned to the process have been completed
      const completedTestsCount = allTestResponses.filter((tr) => tr.isCompleted).length;

      this.logger.log(
        `WorkerProcess ${workerProcessId}: ${completedTestsCount} of ${totalTests} tests completed`,
      );

      if (completedTestsCount < totalTests) {
        this.logger.log(
          `Not all tests completed for WorkerProcess ${workerProcessId}. Skipping report generation.`,
        );
        return;
      }

      // All tests completed → Update status and generate report automatically
      this.logger.log(
        `All tests completed for WorkerProcess ${workerProcessId}. Updating status and generating report...`,
      );

      // Update WorkerProcess status to 'completed'
      await this.updateWorkerProcessStatusOnAllTestsCompleted(workerProcessId, totalTests);

      await this.reportsService.generateReport(workerProcessId);

      this.logger.log(
        `Report successfully generated for WorkerProcess ${workerProcessId}`,
      );
    } catch (error) {
      // Log error but don't fail the test submission
      this.logger.error(
        `Failed to generate report for WorkerProcess ${workerProcessId}:`,
        error.message,
      );
    }
  }

  async autoEvaluate(
    responseId: string,
    completedAt?: Date,
    isCompleted?: boolean,
  ): Promise<TestResponse> {
    const testResponse = await this.testResponseRepository.findOne({
      where: { id: responseId },
      relations: [
        'test',
        'test.questions',
        'fixedTest',
        'answers',
        'answers.question',
        'answers.fixedTestQuestion',
      ],
    });

    if (!testResponse) {
      throw new NotFoundException(
        `TestResponse con ID ${responseId} no encontrado`,
      );
    }

    // Set completion status if provided
    if (completedAt) testResponse.completedAt = completedAt;
    if (isCompleted !== undefined) testResponse.isCompleted = isCompleted;

    // Check if this is a fixed test (psychometric test)
    if (testResponse.fixedTest) {
      return this.evaluateFixedTest(testResponse);
    }

    // Legacy dynamic test evaluation
    let totalScore = 0;
    let maxScore = 0;

    for (const answer of testResponse.answers) {
      const question = answer.question;
      maxScore += question.points;

      if (question.correctAnswers && question.correctAnswers.length > 0) {
        const isCorrect = this.checkAnswer(
          answer.answer,
          question.correctAnswers,
        );
        answer.isCorrect = isCorrect;
        answer.score = isCorrect ? question.points : 0;
        totalScore += answer.score;
        await this.testAnswerRepository.save(answer);
      }
    }

    testResponse.score = totalScore;
    testResponse.maxScore = maxScore;
    testResponse.passed =
      testResponse.test.passingScore !== null &&
      totalScore >= testResponse.test.passingScore;

    return this.testResponseRepository.save(testResponse);
  }

  /**
   * Evaluates fixed tests (psychometric tests like CFR, 16PF, etc.)
   * Routes to appropriate scoring service based on test code
   */
  private async evaluateFixedTest(
    testResponse: TestResponse,
  ): Promise<TestResponse> {
    this.logger.log(
      `Evaluating fixed test: ${testResponse.fixedTest.code} for response ${testResponse.id}`,
    );

    switch (testResponse.fixedTest.code) {
      case FixedTestCode.TEST_CFR:
        const cfrResult =
          this.testCFRScoringService.calculateScore(testResponse.answers);
        testResponse.rawScores = cfrResult.rawScores;
        testResponse.scaledScores = cfrResult.scaledScores;
        testResponse.interpretation = cfrResult.interpretation;
        this.logger.log(
          `CFR Test evaluated: ${cfrResult.rawScores.total}/300 - ${cfrResult.interpretation.nivel}`,
        );
        break;

      case FixedTestCode.TEST_16PF:
        const pf16Result =
          this.test16PFScoringService.calculateScore(testResponse.answers);
        testResponse.rawScores = pf16Result.rawScores;
        testResponse.scaledScores = pf16Result.scaledScores;
        testResponse.interpretation = pf16Result.interpretation;
        this.logger.log(
          `16PF Test evaluated: ${pf16Result.interpretation.resumenGlobal}`,
        );
        break;

      case FixedTestCode.TEST_DISC:
        const discResult =
          this.testDISCScoringService.calculateScore(testResponse.answers);
        testResponse.rawScores = discResult.rawScores;
        testResponse.scaledScores = discResult.scaledScores;
        testResponse.interpretation = discResult.interpretation;
        this.logger.log(
          `DISC Test evaluated: ${discResult.interpretation.perfilPredominante} (${discResult.interpretation.perfilCombinado})`,
        );
        break;

      case FixedTestCode.TEST_IL:
        const ilResult =
          this.testILScoringService.calculateScore(testResponse.answers);
        testResponse.rawScores = ilResult.rawScores;
        testResponse.scaledScores = ilResult.scaledScores;
        testResponse.interpretation = ilResult.interpretation;
        this.logger.log(
          `IL Test evaluated: ${ilResult.rawScores.total}/20 - ${ilResult.interpretation.nivel}`,
        );
        break;

      case FixedTestCode.TEST_IC:
        const icResult =
          this.testICScoringService.calculateScore(testResponse.answers);
        testResponse.rawScores = icResult.rawScores;
        testResponse.scaledScores = icResult.scaledScores;
        testResponse.interpretation = icResult.interpretation;
        this.logger.log(
          `IC Test evaluated: ${icResult.rawScores.total}/20 - ${icResult.interpretation.nivel}`,
        );
        break;

      case FixedTestCode.TEST_TAC:
        const tacResult =
          this.testTACScoringService.calculateScore(testResponse.answers);
        testResponse.rawScores = tacResult.rawScores;
        testResponse.scaledScores = tacResult.scaledScores;
        testResponse.interpretation = tacResult.interpretation;
        this.logger.log(
          `TAC Test evaluated: ${tacResult.scaledScores.global}/5.0 - ${tacResult.interpretation.nivelGlobal}`,
        );
        break;

      default:
        this.logger.warn(
          `No scoring service implemented for fixed test: ${testResponse.fixedTest.code}`,
        );
        break;
    }

    return this.testResponseRepository.save(testResponse);
  }

  private checkAnswer(answer: any, correctAnswers: string[]): boolean {
    if (Array.isArray(answer)) {
      return (
        answer.length === correctAnswers.length &&
        answer.every((a) => correctAnswers.includes(a))
      );
    }
    return correctAnswers.includes(String(answer));
  }

  async evaluateAnswer(
    answerId: string,
    evaluateDto: EvaluateAnswerDto,
  ): Promise<TestAnswer> {
    const answer = await this.testAnswerRepository.findOne({
      where: { id: answerId },
      relations: ['testResponse'],
    });

    if (!answer) {
      throw new NotFoundException(
        `TestAnswer con ID ${answerId} no encontrado`,
      );
    }

    answer.score = evaluateDto.score;
    answer.isCorrect = evaluateDto.isCorrect;
    answer.evaluatorComment = evaluateDto.evaluatorComment;

    await this.testAnswerRepository.save(answer);

    await this.recalculateScore(answer.testResponse.id);

    return answer;
  }

  async recalculateScore(responseId: string): Promise<TestResponse> {
    const testResponse = await this.testResponseRepository.findOne({
      where: { id: responseId },
      relations: ['test', 'answers', 'answers.question'],
    });

    if (!testResponse) {
      throw new NotFoundException(
        `TestResponse con ID ${responseId} no encontrado`,
      );
    }

    let totalScore = 0;
    let maxScore = 0;

    for (const answer of testResponse.answers) {
      maxScore += answer.question.points;
      totalScore += answer.score || 0;
    }

    testResponse.score = totalScore;
    testResponse.maxScore = maxScore;
    testResponse.passed =
      testResponse.test.passingScore !== null &&
      totalScore >= testResponse.test.passingScore;

    return this.testResponseRepository.save(testResponse);
  }

  async findOne(id: string, user?: any): Promise<TestResponse> {
    const testResponse = await this.testResponseRepository.findOne({
      where: { id },
      relations: {
        test: {
          questions: true,
        },
        fixedTest: {
          questions: true,
        },
        workerProcess: {
          worker: {
            user: true,
          },
        },
        answers: {
          question: true,
          fixedTestQuestion: true,
        },
      },
    });

    if (!testResponse) {
      throw new NotFoundException(`TestResponse con ID ${id} no encontrado`);
    }

    // Security: Workers can only access their own test responses
    // TEMPORARILY DISABLED FOR TESTING
    // if (user?.role === 'worker') {
    //   if (testResponse.workerProcess.worker.user.id !== user.sub) {
    //     throw new ForbiddenException('No tienes permiso para acceder a este test');
    //   }
    // }

    return testResponse;
  }

  async findByWorkerProcess(workerProcessId: string): Promise<TestResponse[]> {
    return this.testResponseRepository.find({
      where: { workerProcess: { id: workerProcessId } },
      relations: ['test', 'answers'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByTest(testId: string): Promise<TestResponse[]> {
    return this.testResponseRepository.find({
      where: { test: { id: testId } },
      relations: ['workerProcess', 'answers'],
      order: { createdAt: 'DESC' },
    });
  }

  async getStats(): Promise<{
    total: number;
    completed: number;
    pending: number;
    passed: number;
    failed: number;
  }> {
    const total = await this.testResponseRepository.count();
    const completed = await this.testResponseRepository.count({
      where: { isCompleted: true },
    });
    const pending = total - completed;
    const passed = await this.testResponseRepository.count({
      where: { isCompleted: true, passed: true },
    });
    const failed = await this.testResponseRepository.count({
      where: { isCompleted: true, passed: false },
    });

    return {
      total,
      completed,
      pending,
      passed,
      failed,
    };
  }

  /**
   * Updates WorkerProcess status from 'pending' to 'in_process' when first test is started
   */
  private async updateWorkerProcessStatusOnTestStart(
    workerProcessId: string,
  ): Promise<void> {
    try {
      const workerProcess = await this.workerProcessRepository.findOne({
        where: { id: workerProcessId },
      });

      if (!workerProcess) {
        this.logger.warn(
          `WorkerProcess ${workerProcessId} not found when trying to update status`,
        );
        return;
      }

      // Only update if currently pending
      if (workerProcess.status === WorkerStatus.PENDING) {
        workerProcess.status = WorkerStatus.IN_PROCESS;
        await this.workerProcessRepository.save(workerProcess);
        this.logger.log(
          `WorkerProcess ${workerProcessId} status updated from 'pending' to 'in_process'`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to update WorkerProcess status on test start: ${error.message}`,
      );
    }
  }

  /**
   * Updates WorkerProcess status to 'completed' when all required tests are completed
   * This method verifies that the worker has completed ALL tests assigned to the process
   */
  private async updateWorkerProcessStatusOnAllTestsCompleted(
    workerProcessId: string,
    completedTestCount: number,
  ): Promise<void> {
    try {
      const workerProcess = await this.workerProcessRepository.findOne({
        where: { id: workerProcessId },
        relations: ['process', 'process.tests', 'process.fixedTests'],
      });

      if (!workerProcess) {
        this.logger.warn(
          `WorkerProcess ${workerProcessId} not found when trying to update to completed`,
        );
        return;
      }

      // Calculate total required tests (custom tests + fixed tests)
      const totalRequiredTests =
        (workerProcess.process.tests?.length || 0) +
        (workerProcess.process.fixedTests?.length || 0);

      // Verify that the completed count matches the required count
      if (completedTestCount === totalRequiredTests && totalRequiredTests > 0) {
        workerProcess.status = WorkerStatus.COMPLETED; // Use COMPLETED when all tests are done
        workerProcess.totalScore = 0; // Will be calculated from test scores
        await this.workerProcessRepository.save(workerProcess);
        this.logger.log(
          `WorkerProcess ${workerProcessId} status updated to 'completed' after completing ${completedTestCount}/${totalRequiredTests} tests`,
        );
      } else {
        this.logger.warn(
          `WorkerProcess ${workerProcessId} has ${completedTestCount} completed tests but process requires ${totalRequiredTests} tests`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to update WorkerProcess status on all tests completed: ${error.message}`,
      );
    }
  }
}
