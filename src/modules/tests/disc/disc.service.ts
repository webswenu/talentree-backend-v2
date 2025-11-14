import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTestService } from '../shared/services/base-test.service';
import { FixedTest } from '../entities/fixed-test.entity';
import { FixedTestQuestion } from '../entities/fixed-test-question.entity';
import { TestResponse } from '../../test-responses/entities/test-response.entity';
import { TestAnswer } from '../../test-responses/entities/test-answer.entity';
import { FixedTestCode } from '../shared/enums';
import { ITestScoring, ITestSubmission } from '../shared/interfaces';
import { DiscScoringService } from './disc-scoring.service';
import { DISC_DIMENSIONS } from './constants/disc-dimensions.constant';

@Injectable()
export class DiscService extends BaseTestService {
  protected testCode = FixedTestCode.TEST_DISC;

  constructor(
    @InjectRepository(FixedTest)
    fixedTestRepository: Repository<FixedTest>,
    @InjectRepository(FixedTestQuestion)
    fixedTestQuestionRepository: Repository<FixedTestQuestion>,
    @InjectRepository(TestResponse)
    testResponseRepository: Repository<TestResponse>,
    @InjectRepository(TestAnswer)
    testAnswerRepository: Repository<TestAnswer>,
    private readonly scoringService: DiscScoringService,
  ) {
    super(
      fixedTestRepository,
      fixedTestQuestionRepository,
      testResponseRepository,
      testAnswerRepository,
    );
  }

  async scoreTest(submission: ITestSubmission): Promise<ITestScoring> {
    return this.scoringService.scoreTest(submission);
  }

  async validateAnswers(submission: ITestSubmission): Promise<boolean> {
    const questions = await this.getTestQuestions();

    if (submission.answers.length !== questions.length) {
      throw new BadRequestException(
        `Expected ${questions.length} answers, got ${submission.answers.length}`,
      );
    }

    const validDimensions = ['D', 'I', 'S', 'C'];

    for (const answer of submission.answers) {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) {
        throw new BadRequestException(
          `Question ${answer.questionId} not found`,
        );
      }

      const discAnswer = answer.answer as { mas?: string; menos?: string };

      if (!discAnswer.mas || !discAnswer.menos) {
        throw new BadRequestException(
          `Invalid answer for question ${question.questionNumber}: must have 'mas' and 'menos'`,
        );
      }

      if (
        !validDimensions.includes(discAnswer.mas) ||
        !validDimensions.includes(discAnswer.menos)
      ) {
        throw new BadRequestException(
          `Invalid answer for question ${question.questionNumber}: must be D, I, S, or C`,
        );
      }

      if (discAnswer.mas === discAnswer.menos) {
        throw new BadRequestException(
          `Invalid answer for question ${question.questionNumber}: 'mas' and 'menos' must be different`,
        );
      }
    }

    return true;
  }

  async getTestInstructions(): Promise<any> {
    const test = await this.getTest();

    return {
      testCode: this.testCode,
      name: test.name,
      description: test.description,
      duration: test.duration,
      questionCount: 24,
      questionType: 'forced_choice',
      instructions: [
        'Este test consta de 24 bloques, cada uno con 4 palabras que describen comportamientos.',
        'Para cada bloque, seleccione:',
        '  - UNA palabra que MÁS lo describe',
        '  - UNA palabra que MENOS lo describe',
        'No hay respuestas correctas o incorrectas, responda con honestidad.',
        `Tiene ${test.duration} minutos para completar el test.`,
        'El test evalúa 4 dimensiones de personalidad: Dominancia, Influencia, Estabilidad y Cumplimiento.',
      ],
      dimensions: DISC_DIMENSIONS.map((d) => ({
        code: d.code,
        name: d.name,
        description: d.description,
      })),
    };
  }

  async submitTest(submission: ITestSubmission): Promise<TestResponse> {
    await this.validateAnswers(submission);

    const scoring = await this.scoreTest(submission);

    return this.saveTestResponse(submission, scoring);
  }
}
