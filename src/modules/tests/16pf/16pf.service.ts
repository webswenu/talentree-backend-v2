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
import { SixteenPfScoringService } from './16pf-scoring.service';
import { FACTORS_16PF } from './constants/16pf-factors.constant';

@Injectable()
export class SixteenPfService extends BaseTestService {
  protected testCode = FixedTestCode.TEST_16PF;

  constructor(
    @InjectRepository(FixedTest)
    fixedTestRepository: Repository<FixedTest>,
    @InjectRepository(FixedTestQuestion)
    fixedTestQuestionRepository: Repository<FixedTestQuestion>,
    @InjectRepository(TestResponse)
    testResponseRepository: Repository<TestResponse>,
    @InjectRepository(TestAnswer)
    testAnswerRepository: Repository<TestAnswer>,
    private readonly scoringService: SixteenPfScoringService,
  ) {
    super(
      fixedTestRepository,
      fixedTestQuestionRepository,
      testResponseRepository,
      testAnswerRepository,
    );
  }

  async scoreTest(submission: ITestSubmission): Promise<ITestScoring> {
    const test = await this.getTest();
    const questions = await this.getTestQuestions();

    const normativeTable = test.configuration?.normativeTable;
    if (!normativeTable || !Array.isArray(normativeTable)) {
      throw new BadRequestException(
        'Este test no tiene su tabla de puntuacion configurada, asi que no se puede corregir. Contacta al equipo de Talentree.',
      );
    }

    return this.scoringService.scoreTest(submission, questions, normativeTable);
  }

  async validateAnswers(submission: ITestSubmission): Promise<boolean> {
    const questions = await this.getTestQuestions();

    if (submission.answers.length !== questions.length) {
      throw new BadRequestException(
        `Faltan respuestas: enviaste ${submission.answers.length} de ${questions.length} preguntas. Revisa las que quedaron en blanco antes de enviar.`,
      );
    }

    for (const answer of submission.answers) {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) {
        throw new BadRequestException(
          'Hubo un problema con una de las preguntas de este test. Avisale al equipo de Talentree; tus respuestas no se perdieron.',
        );
      }

      if (!['A', 'B', 'C'].includes(answer.answer)) {
        throw new BadRequestException(
          `La respuesta de la pregunta ${question.questionNumber} no es valida. Vuelve a seleccionar una de las opciones (A, B o C).`,
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
      questionCount: 180,
      questionType: 'multiple_choice_ternary',
      instructions: [
        'Este test consta de 180 preguntas que evalúan 16 factores de personalidad.',
        'Para cada pregunta, seleccione la opción que mejor lo describa: A, B o C.',
        'No hay respuestas correctas o incorrectas, responda con honestidad.',
        `Tiene ${test.duration} minutos para completar el test.`,
        'Trate de no dejar preguntas sin responder.',
      ],
      factors: FACTORS_16PF.map((f) => ({
        code: f.code,
        name: f.name,
      })),
    };
  }

  async submitTest(submission: ITestSubmission): Promise<TestResponse> {
    await this.validateAnswers(submission);

    const scoring = await this.scoreTest(submission);

    return this.saveTestResponse(submission, scoring);
  }
}
