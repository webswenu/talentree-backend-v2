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
import { IcScoringService } from './ic-scoring.service';

@Injectable()
export class IcService extends BaseTestService {
  protected testCode = FixedTestCode.TEST_IC;

  constructor(
    @InjectRepository(FixedTest)
    fixedTestRepository: Repository<FixedTest>,
    @InjectRepository(FixedTestQuestion)
    fixedTestQuestionRepository: Repository<FixedTestQuestion>,
    @InjectRepository(TestResponse)
    testResponseRepository: Repository<TestResponse>,
    @InjectRepository(TestAnswer)
    testAnswerRepository: Repository<TestAnswer>,
    private readonly scoringService: IcScoringService,
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

      if (Array.isArray(answer.answer) && answer.answer.length === 0) {
        throw new BadRequestException(
          `Answer for question ${question.questionNumber} cannot be empty`,
        );
      }
    }

    return true;
  }

  async getTestInstructions(): Promise<any> {
    const test = await this.getTest();
    const questions = await this.getTestQuestions();

    return {
      testCode: this.testCode,
      name: test.name,
      description: test.description,
      duration: test.duration,
      questionCount: questions.length,
      questionType: 'table_checkbox',
      instructions: [
        'Este test evalúa su capacidad para seguir instrucciones complejas.',
        'Se le presentará una tabla con filas y columnas.',
        'Lea cuidadosamente las instrucciones para cada pregunta.',
        'Marque las casillas correspondientes según las instrucciones.',
        'Preste mucha atención a los detalles de cada instrucción.',
        `Tiene ${test.duration} minutos para completar el test.`,
        'No hay respuestas correctas o incorrectas en el sentido tradicional.',
        'Lo que se evalúa es su capacidad para seguir instrucciones precisas.',
      ],
      scoring: {
        basis: 'Comparación con patrón de respuesta esperado',
        interpretation: {
          bajo: '0-50% - Dificultad para seguir instrucciones complejas',
          medio: '51-75% - Capacidad adecuada',
          alto: '76-100% - Excelente capacidad',
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
