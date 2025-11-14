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
import { WonderlicScoringService } from './wonderlic-scoring.service';

@Injectable()
export class WonderlicService extends BaseTestService {
  protected testCode = FixedTestCode.TEST_IL;

  constructor(
    @InjectRepository(FixedTest)
    fixedTestRepository: Repository<FixedTest>,
    @InjectRepository(FixedTestQuestion)
    fixedTestQuestionRepository: Repository<FixedTestQuestion>,
    @InjectRepository(TestResponse)
    testResponseRepository: Repository<TestResponse>,
    @InjectRepository(TestAnswer)
    testAnswerRepository: Repository<TestAnswer>,
    private readonly scoringService: WonderlicScoringService,
  ) {
    super(
      fixedTestRepository,
      fixedTestQuestionRepository,
      testResponseRepository,
      testAnswerRepository,
    );
  }

  async scoreTest(submission: ITestSubmission): Promise<ITestScoring> {
    const questions = await this.getTestQuestions();
    return this.scoringService.scoreTest(submission, questions);
  }

  async validateAnswers(submission: ITestSubmission): Promise<boolean> {
    const questions = await this.getTestQuestions();

    if (submission.answers.length !== questions.length) {
      throw new BadRequestException(
        `Expected ${questions.length} answers, got ${submission.answers.length}`,
      );
    }

    for (const answer of submission.answers) {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) {
        throw new BadRequestException(
          `Question ${answer.questionId} not found`,
        );
      }

      if (answer.answer === null || answer.answer === undefined) {
        throw new BadRequestException(
          `Answer for question ${question.questionNumber} is missing`,
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
      questionCount: 20,
      questionType: 'multiple_choice',
      instructions: [
        'Este test evalúa inteligencia laboral mediante 20 preguntas de opción múltiple.',
        'Cada pregunta tiene una única respuesta correcta.',
        'Lea cuidadosamente cada pregunta antes de responder.',
        `Tiene ${test.duration} minutos para completar el test.`,
        'Su puntuación se interpretará como: Bajo (0-7), Medio (8-14), Alto (15-20).',
      ],
      scoring: {
        maxScore: 20,
        ranges: {
          bajo: '0-7 puntos',
          medio: '8-14 puntos',
          alto: '15-20 puntos',
        },
      },
    };
  }

  async submitTest(submission: ITestSubmission): Promise<TestResponse> {
    await this.validateAnswers(submission);

    const scoring = await this.scoreTest(submission);

    return this.saveTestResponse(submission, scoring);
  }
}
