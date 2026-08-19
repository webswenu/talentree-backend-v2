import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FixedTest } from '../../entities/fixed-test.entity';
import { FixedTestQuestion } from '../../entities/fixed-test-question.entity';
import { TestResponse } from '../../../test-responses/entities/test-response.entity';
import { TestAnswer } from '../../../test-responses/entities/test-answer.entity';
import { FixedTestCode } from '../enums';
import { ITestScoring, ITestSubmission, ITestService } from '../interfaces';
import { WorkerProcess } from '../../../workers/entities/worker-process.entity';
import { assertPuedeAccederAPostulacion } from '../../../../common/helpers/ownership.helper';

@Injectable()
export abstract class BaseTestService implements ITestService {
  protected abstract testCode: FixedTestCode;

  constructor(
    @InjectRepository(FixedTest)
    protected readonly fixedTestRepository: Repository<FixedTest>,
    @InjectRepository(FixedTestQuestion)
    protected readonly fixedTestQuestionRepository: Repository<FixedTestQuestion>,
    @InjectRepository(TestResponse)
    protected readonly testResponseRepository: Repository<TestResponse>,
    @InjectRepository(TestAnswer)
    protected readonly testAnswerRepository: Repository<TestAnswer>,
  ) {}

  async getTest(): Promise<FixedTest> {
    const test = await this.fixedTestRepository.findOne({
      where: { code: this.testCode, isActive: true },
      relations: ['questions'],
      order: {
        questions: {
          questionNumber: 'ASC',
        },
      },
    });

    if (!test) {
      throw new NotFoundException(
        'Este test no esta disponible en este momento. Si crees que es un error, contacta al equipo de Talentree.',
      );
    }

    return test;
  }

  async getTestQuestions(): Promise<FixedTestQuestion[]> {
    const test = await this.getTest();
    return this.fixedTestQuestionRepository.find({
      where: { fixedTestId: test.id },
      order: { questionNumber: 'ASC' },
    });
  }

  /**
   * Corta el paso si la postulacion que viene en el cuerpo no es de quien envia.
   *
   * EL DEFECTO QUE CIERRA: los cinco endpoints `POST /tests/<test>/submit`
   * reciben `workerProcessId` y `workerId` EN EL CUERPO y no comprobaban nada
   * mas alla del rol. Un candidato podia fabricar un test completo, puntuado y
   * marcado como terminado sobre la postulacion de otra persona, con el perfil
   * psicometrico que quisiera.
   *
   * Se llega al repositorio por el `manager` a proposito: agregarlo al
   * constructor obligaria a tocar las seis subclases sin ganar nada.
   */
  protected async asegurarPostulacionPropia(
    workerProcessId: string,
    user: any,
  ): Promise<void> {
    const postulaciones =
      this.testResponseRepository.manager.getRepository(WorkerProcess);

    const postulacion = await postulaciones.findOne({
      where: { id: workerProcessId },
      relations: {
        worker: { user: true },
        process: { company: true, evaluators: true },
      },
    });

    if (!postulacion) {
      throw new NotFoundException(
        'No encontramos esa postulación. Vuelve a entrar al proceso desde tu panel.',
      );
    }

    assertPuedeAccederAPostulacion(
      user,
      {
        usuarioDelCandidato: postulacion.worker?.user?.id,
        empresaDelProceso: postulacion.process?.company?.id,
        evaluadoresDelProceso: (postulacion.process?.evaluators || []).map(
          (evaluador) => evaluador.id,
        ),
      },
      'este test',
    );
  }

  async saveTestResponse(
    submission: ITestSubmission,
    scoring: ITestScoring,
  ): Promise<TestResponse> {
    const test = await this.getTest();

    const testResponse = this.testResponseRepository.create({
      fixedTestId: test.id,
      workerProcess: { id: submission.workerProcessId } as any,
      startedAt: submission.startedAt,
      completedAt: submission.completedAt,
      isCompleted: true,
      rawScores: scoring.rawScores,
      scaledScores: scoring.scaledScores,
      interpretation: scoring.interpretation,
      metadata: {
        ...submission.metadata,
        completionTime: scoring.completionTime,
      },
    });

    const savedResponse = await this.testResponseRepository.save(testResponse);

    const answers = submission.answers.map((answer) =>
      this.testAnswerRepository.create({
        testResponse: { id: savedResponse.id } as any,
        fixedTestQuestionId: answer.questionId,
        answer: answer.answer,
      }),
    );

    await this.testAnswerRepository.save(answers);

    return this.testResponseRepository.findOne({
      where: { id: savedResponse.id },
      relations: ['answers', 'fixedTest'],
    });
  }

  abstract scoreTest(submission: ITestSubmission): Promise<ITestScoring>;
  abstract validateAnswers(submission: ITestSubmission): Promise<boolean>;
  abstract getTestInstructions(): Promise<any>;
}
