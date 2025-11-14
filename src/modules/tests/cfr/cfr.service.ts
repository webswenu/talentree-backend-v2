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
import { CfrScoringService } from './cfr-scoring.service';

@Injectable()
export class CfrService extends BaseTestService {
  protected testCode = FixedTestCode.TEST_CFR;

  constructor(
    @InjectRepository(FixedTest)
    fixedTestRepository: Repository<FixedTest>,
    @InjectRepository(FixedTestQuestion)
    fixedTestQuestionRepository: Repository<FixedTestQuestion>,
    @InjectRepository(TestResponse)
    testResponseRepository: Repository<TestResponse>,
    @InjectRepository(TestAnswer)
    testAnswerRepository: Repository<TestAnswer>,
    private readonly scoringService: CfrScoringService,
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

    for (const answer of submission.answers) {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) {
        throw new BadRequestException(
          `Question ${answer.questionId} not found`,
        );
      }

      const likertValue = parseInt(answer.answer, 10);
      if (isNaN(likertValue) || likertValue < 1 || likertValue > 5) {
        throw new BadRequestException(
          `Invalid answer for question ${question.questionNumber}: must be between 1 and 5`,
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
      questionCount: 60,
      questionType: 'likert_scale',
      instructions: [
        'Este test evalúa su conducta frente al riesgo mediante 60 afirmaciones.',
        'Para cada afirmación, indique su nivel de acuerdo usando la escala:',
        '  1 = Totalmente en desacuerdo',
        '  2 = En desacuerdo',
        '  3 = Neutral',
        '  4 = De acuerdo',
        '  5 = Totalmente de acuerdo',
        'Responda con honestidad según cómo actuaría normalmente.',
        `Tiene ${test.duration} minutos para completar el test.`,
      ],
      scoring: {
        scale: '1-5 (Likert)',
        interpretation: {
          bajo: '≤120 puntos - Bajo nivel de riesgo',
          medio: '121-200 puntos - Nivel moderado de riesgo',
          alto: '>200 puntos - Alto nivel de riesgo',
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
