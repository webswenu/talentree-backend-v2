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
        `Faltan respuestas: enviaste ${submission.answers.length} de ${questions.length} preguntas. Revisa las que quedaron en blanco antes de enviar.`,
      );
    }

    const validDimensions = ['D', 'I', 'S', 'C'];

    for (const answer of submission.answers) {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) {
        throw new BadRequestException(
          'Hubo un problema con una de las preguntas de este test. Avisale al equipo de Talentree; tus respuestas no se perdieron.',
        );
      }

      const discAnswer = answer.answer as { mas?: string; menos?: string };

      if (!discAnswer.mas || !discAnswer.menos) {
        throw new BadRequestException(
          `En la pregunta ${question.questionNumber} tienes que marcar una opción como la que MAS te representa y otra como la que MENOS.`,
        );
      }

      if (
        !validDimensions.includes(discAnswer.mas) ||
        !validDimensions.includes(discAnswer.menos)
      ) {
        throw new BadRequestException(
          `La respuesta de la pregunta ${question.questionNumber} no es válida. Vuelve a seleccionarla.`,
        );
      }

      if (discAnswer.mas === discAnswer.menos) {
        throw new BadRequestException(
          `En la pregunta ${question.questionNumber} marcaste la misma opción como la que mas y la que menos te representa. Tienen que ser distintas.`,
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

  async submitTest(
    submission: ITestSubmission,
    user?: any,
  ): Promise<TestResponse> {
    /**
     * La postulacion viaja en el CUERPO de la peticion, asi que la elige
     * quien llama. Sin esta comprobacion, un candidato podia enviar un test
     * completo y puntuado sobre la postulacion de otra persona.
     */
    await this.asegurarPostulacionPropia(submission.workerProcessId, user);

    await this.validateAnswers(submission);

    const scoring = await this.scoreTest(submission);

    return this.saveTestResponse(submission, scoring);
  }
}
