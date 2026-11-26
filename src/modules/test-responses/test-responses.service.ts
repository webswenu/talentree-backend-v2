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
import { TestCEALScoringService } from './scoring/test-ceal-scoring.service';
import { TestBIS11ScoringService } from './scoring/test-bis11-scoring.service';
import { FixedTestCode } from '../tests/shared/enums/fixed-test-code.enum';
import { WorkerStatus } from '../../common/enums/worker-status.enum';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { UsersService } from '../users/users.service';
import { EmailHelper } from '../../common/helpers/email.helper';
import {
  buildTestsCompletedEmail,
  buildTestReactivadoEmail,
  buildParticipacionReiniciadaEmail,
  buildTestReiniciadoEmail,
} from '../../common/helpers/worker-emails';
import { ReactivarTestDto } from './dto/reactivar-test.dto';
import { ReiniciarParticipacionDto } from './dto/reiniciar-participacion.dto';
import { ReiniciarTestDto } from './dto/reiniciar-test.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../../common/enums/audit-action.enum';
import { ProcessStatus } from '../../common/enums/process-status.enum';
import { ReportStatus } from '../../common/enums/report-status.enum';
import { procesoVencido } from '../../common/helpers/vigencia-proceso.helper';
import { assertPuedeAccederAPostulacion } from '../../common/helpers/ownership.helper';

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
    private readonly testCEALScoringService: TestCEALScoringService,
    private readonly testBIS11ScoringService: TestBIS11ScoringService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Carga una postulacion con lo justo para decidir quien puede tocarla y
   * corta el paso si no corresponde.
   *
   * Se resuelve aqui, contra la base, y no confiando en lo que venga en el
   * cuerpo de la peticion: el `workerProcessId` lo elige quien llama.
   */
  private async asegurarAccesoAPostulacion(
    workerProcessId: string,
    user: any,
    recurso = 'esta postulación',
  ): Promise<WorkerProcess> {
    const postulacion = await this.workerProcessRepository.findOne({
      where: { id: workerProcessId },
      relations: {
        worker: { user: true },
        process: { company: true, evaluators: true },
      },
    });

    if (!postulacion) {
      throw new NotFoundException(
        'No encontramos esa postulación. Puede que el enlace esté mal copiado o que ya no exista.',
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
      recurso,
    );

    return postulacion;
  }

  async startTest(startTestDto: StartTestDto, user?: any): Promise<TestResponse> {
    /**
     * Antes se tomaba el `workerProcessId` del cuerpo sin comprobar nada, asi
     * que cualquier candidato podia arrancar un test sobre la postulacion de
     * otro, y de paso moverle el estado de «pendiente» a «en proceso».
     */
    await this.asegurarAccesoAPostulacion(
      startTestDto.workerProcessId,
      user,
      'esta postulación',
    );

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
        // Sin esto la pantalla de revision del evaluador mostraba la linea
        // "Proceso:" en blanco: pedia workerProcess.process.name y la relacion
        // nunca se cargaba.
        'workerProcess.process',
      ],
    });

    if (!testResponse) {
      throw new NotFoundException(
        `TestResponse con ID ${responseId} no encontrado`,
      );
    }

    /**
     * Aqui vivia el control de dueño, comentado con la nota
     * `// TEMPORARILY DISABLED FOR TESTING`. Sin el, cualquier candidato con
     * sesion iniciada podia enviar el test de otro con `{"answers":[]}` y
     * dejarselo cerrado: la victima entraba a rendirlo y se lo encontraba
     * completado y puntuado.
     *
     * No se reactivo tal cual porque comparaba contra `user.sub`, que es
     * `undefined` (la estrategia JWT devuelve la entidad User, con `id`).
     * Descomentarlo habria dado 403 a TODOS sobre su propio test.
     */
    await this.asegurarAccesoAPostulacion(
      testResponse.workerProcess.id,
      user,
      'este test',
    );

    if (testResponse.isCompleted) {
      throw new BadRequestException('Este test ya ha sido completado');
    }

    const isFixedTest = !!testResponse.fixedTest;

    /**
     * Un envío sin respuestas solo se acepta cuando el tiempo de verdad se
     * acabó, medido con el reloj del SERVIDOR.
     *
     * El 19-11-2026 una candidata con el PC adelantado abrió DISC, IC e IL y
     * el temporizador del navegador —que comparaba su reloj con `startedAt`—
     * los dio por vencidos y los envió vacíos al segundo. Esto se aceptaba,
     * cerraba la postulación y generaba un informe sin un solo dato.
     *
     * Los tests sin tiempo (CEAL, BIS-11: `duration` null) nunca vencen, así
     * que para ellos un envío vacío siempre se rechaza.
     */
    const duracionMinutos = isFixedTest
      ? testResponse.fixedTest.duration
      : testResponse.test?.duration;
    // `startedAt` lo escribe este mismo proceso con `new Date()` y el driver
    // lo lee en la misma zona horaria, así que la resta es coherente.
    const transcurridoMs = testResponse.startedAt
      ? Date.now() - new Date(testResponse.startedAt).getTime()
      : 0;
    const margenMs = 30 * 1000; // relojes y latencia
    const tiempoVencido =
      !!duracionMinutos && transcurridoMs >= duracionMinutos * 60 * 1000 - margenMs;
    if ((submitTestDto.answers?.length ?? 0) === 0 && !tiempoVencido) {
      throw new BadRequestException(
        'No se puede enviar el test sin respuestas. Responde al menos una pregunta antes de enviarlo.',
      );
    }

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

    /**
     * `testResponse.answers` se cargó ANTES de guardar las respuestas nuevas,
     * así que no las trae. Con `cascade: true`, el `save(testResponse)` de más
     * abajo trataba las que faltan como quitadas de la relación y les ponía
     * `test_response_id = NULL`. Pasaba en cada test que no se completaba al
     * 100 % (el camino completo recarga con `autoEvaluate` y se salvaba): el
     * 20 y 21-11-2026 quedaron 600 respuestas de cinco 16PF sueltas.
     */
    testResponse.answers = undefined as unknown as TestAnswer[];

    // Determine test status based on answered questions
    const totalQuestions = isFixedTest
      ? testResponse.fixedTest.questions?.length || 0
      : testResponse.test.questions?.length || 0;
    // Preguntas distintas que pertenecen a este test. Antes se contaba
    // `answers.length` del cuerpo, y 30 copias de la misma pregunta pasaban
    // por un test de 30 preguntas respondido al 100 %.
    const idsDelTest = new Set(
      (isFixedTest ? testResponse.fixedTest.questions : testResponse.test.questions)?.map(
        (q) => q.id,
      ) ?? [],
    );
    const answeredQuestions = new Set(
      submitTestDto.answers
        .map((a) => a.questionId)
        .filter((id) => idsDelTest.has(id)),
    ).size;
    const answerPercentage = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;

    /**
     * El test lo cerró el reloj, no la persona. Si el front avisa que la
     * persona pulsó «Finalizar» (`cierreAutomatico: false`) se le cree aunque
     * esté dentro del margen; un front antiguo no manda el campo y decide el
     * reloj del servidor.
     */
    const cerradoPorTiempo = tiempoVencido && submitTestDto.cierreAutomatico !== false;

    /**
     * 'completed' solo si respondió el 100 %. Además, un test de UNA sola
     * pregunta que cerró el reloj nunca cuenta como completo: el IC es una
     * planilla en una sola pregunta, y basta marcar una casilla para que
     * «responda el 100 %». El 26-11-2026 un IC cerrado a los 12 min con 2
     * casillas marcadas quedó «Completado» y el admin no pudo reactivarlo.
     */
    const testStatus =
      answerPercentage === 100 && !(cerradoPorTiempo && totalQuestions === 1)
        ? 'completed'
        : 'insufficient_answers';
    const completedAt = new Date();
    const isCompleted = true; // Always true when submitted

    this.logger.log(
      `Test ${responseId}: ${answeredQuestions}/${totalQuestions} preguntas respondidas (${answerPercentage.toFixed(1)}%) - Status: ${testStatus}`,
    );

    // Save workerProcessId before evaluation (needed for report generation)
    const workerProcessId = testResponse.workerProcess.id;

    if (testStatus === 'completed') {
      // Auto-evaluate based on test type
      const requiresManualReview = isFixedTest
        ? false // Fixed tests are always auto-evaluated
        : testResponse.test.requiresManualReview;

      if (!requiresManualReview) {
        // autoEvaluate will save the entity with scoring data AND completion status
        testResponse = await this.autoEvaluate(responseId, completedAt, isCompleted);
        // Update status after evaluation
        testResponse.status = testStatus;
        testResponse = await this.testResponseRepository.save(testResponse);
      } else {
        // Save manually if no auto-evaluation
        testResponse.completedAt = completedAt;
        testResponse.isCompleted = isCompleted;
        testResponse.status = testStatus;
        testResponse = await this.testResponseRepository.save(testResponse);

        // Notificar a los evaluadores del proceso que hay un nuevo test para evaluar
        try {
          const processWithEvaluators = await this.selectionProcessRepository.findOne({
            where: { id: testResponse.workerProcess.process.id },
            relations: ['evaluators'],
          });

          if (processWithEvaluators?.evaluators?.length > 0) {
            const evaluatorIds = processWithEvaluators.evaluators.map((evaluator) => evaluator.id);

            await this.notificationsGateway.broadcastNotification(evaluatorIds, {
              title: 'Nuevo test para evaluar',
              message: `${testResponse.workerProcess.worker.firstName} ${testResponse.workerProcess.worker.lastName} ha completado el test "${testResponse.test.name}" y requiere evaluación manual`,
              type: NotificationType.TEST_ASSIGNED,
              link: `/evaluador/revisar/${responseId}`,
            });
          }
        } catch (error) {
          this.logger.error(
            `Error sending notification to evaluators for manual review: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } else {
      /**
       * Test incompleto. Desde el 21-11-2026 (pedido de la clienta) un test
       * fijo cortado se calcula igual con las respuestas que haya, y el
       * informe avisa que no se completó. `status` sigue siendo
       * `insufficient_answers`: es lo que marca «Incompleto» en todas partes.
       *
       * `motivo` distingue el corte por tiempo de un envío a medias, para que
       * el informe diga lo correcto.
       */
      const metadata = {
        ...testResponse.metadata,
        answeredQuestions,
        totalQuestions,
        answerPercentage: parseFloat(answerPercentage.toFixed(1)),
        motivo: cerradoPorTiempo ? 'tiempo' : 'envio_incompleto',
        duracionMinutos: duracionMinutos ?? null,
      };

      let calculado = false;
      if (isFixedTest && answeredQuestions > 0) {
        try {
          testResponse = await this.autoEvaluate(responseId, completedAt, isCompleted);
          calculado = true;
        } catch (error) {
          // Si un motor no aguanta respuestas faltantes, el test queda como
          // antes: incompleto y sin resultados. Nunca se pierde el envío.
          this.logger.error(
            `No se pudo calcular el test incompleto ${responseId}: ${error instanceof Error ? error.message : String(error)}`,
          );
          testResponse = (await this.testResponseRepository.findOne({ where: { id: responseId } }))!;
        }
      }

      testResponse.isCompleted = isCompleted;
      testResponse.completedAt = completedAt;
      testResponse.status = testStatus;
      testResponse.metadata = { ...metadata, calculadoParcial: calculado };
      testResponse = await this.testResponseRepository.save(testResponse);
    }

    // Check if all tests are completed and auto-generate report
    await this.checkAndGenerateReport(workerProcessId);

    // Notificar a todos los administradores sobre el test completado
    try {
      // Recargar con relaciones necesarias
      const testResponseWithRelations = await this.testResponseRepository.findOne({
        where: { id: responseId },
        relations: [
          'workerProcess',
          'workerProcess.worker',
          'workerProcess.process',
          'workerProcess.process.company',
          'test',
          'fixedTest',
        ],
      });

      if (testResponseWithRelations) {
        const admins = await this.usersService.findAdminUsers();
        const adminIds = admins.map((admin) => admin.id);

        const testName = isFixedTest
          ? testResponseWithRelations.fixedTest?.name
          : testResponseWithRelations.test?.name;

        if (adminIds.length > 0) {
          await this.notificationsGateway.broadcastNotification(adminIds, {
            title: 'Test completado',
            message: `${testResponseWithRelations.workerProcess.worker.firstName} ${testResponseWithRelations.workerProcess.worker.lastName} ha completado el test "${testName}"`,
            type: NotificationType.TEST_ASSIGNED,
            link: `/admin/procesos/${testResponseWithRelations.workerProcess.process.id}`,
          });
        }

        // Notificar también a los usuarios de la empresa
        if (testResponseWithRelations.workerProcess.process.company?.id) {
          const companyUsers = await this.usersService.findCompanyUsers(
            testResponseWithRelations.workerProcess.process.company.id
          );
          const companyUserIds = companyUsers.map((user) => user.id);

          if (companyUserIds.length > 0) {
            await this.notificationsGateway.broadcastNotification(companyUserIds, {
              title: 'Test completado en tu proceso',
              message: `${testResponseWithRelations.workerProcess.worker.firstName} ${testResponseWithRelations.workerProcess.worker.lastName} ha completado el test "${testName}"`,
              type: NotificationType.TEST_ASSIGNED,
              link: `/empresa/procesos/${testResponseWithRelations.workerProcess.process.id}`,
            });
          }
        }

        // Notificar al trabajador sobre el resultado de su evaluación (solo si fue auto-evaluado)
        const wasAutoEvaluated = testResponseWithRelations.passed !== null && testResponseWithRelations.passed !== undefined;
        if (wasAutoEvaluated) {
          const workerUserId = testResponseWithRelations.workerProcess.worker.user?.id;
          if (workerUserId) {
            const passed = testResponseWithRelations.passed;
            await this.notificationsGateway.broadcastNotification([workerUserId], {
              title: passed ? 'Test aprobado' : 'Resultado de test',
              message: `Has ${passed ? 'aprobado' : 'completado'} el test "${testName}"${passed ? ' exitosamente' : ''}`,
              type: passed ? NotificationType.SUCCESS : NotificationType.INFO,
              link: `/trabajador/postulaciones/${testResponseWithRelations.workerProcess.id}`,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Error sending notification for completed test: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

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

      // Count tests with status 'completed' (not 'insufficient_answers')
      const completedTestsCount = allTestResponses.filter((tr) => tr.status === 'completed').length;
      const insufficientTestsCount = allTestResponses.filter((tr) => tr.status === 'insufficient_answers').length;
      // Solo los ENVIADOS. `startTest` crea la fila al abrir el test, así que
      // contarlas todas daba la postulación por terminada —y generaba el
      // informe— con tests abiertos y nunca enviados.
      const submittedTestsCount = allTestResponses.filter((tr) => tr.isCompleted).length;

      this.logger.log(
        `WorkerProcess ${workerProcessId}: ${completedTestsCount} completed / ${insufficientTestsCount} insufficient / ${submittedTestsCount} submitted / ${totalTests} total tests`,
      );

      // Check if all tests have been submitted (completed or insufficient)
      if (submittedTestsCount < totalTests) {
        this.logger.log(
          `Not all tests submitted for WorkerProcess ${workerProcessId} (${submittedTestsCount}/${totalTests}). Skipping report generation.`,
        );
        return;
      }

      // All tests completed → Update status and generate report automatically
      this.logger.log(
        `All tests completed for WorkerProcess ${workerProcessId}. Updating status and generating report...`,
      );

      // Update WorkerProcess status to 'completed'
      await this.updateWorkerProcessStatusOnAllTestsCompleted(workerProcessId, totalTests);

      // Sin un solo test con resultado, el informe saldría vacío y llegaría
      // igual a revisión del admin. La postulación queda «completada» y el
      // admin la ve sin informe, que es lo que corresponde.
      // Un incompleto calculado con lo que alcanzó a responder también da
      // resultado (ver la rama `insufficient_answers` de submitTest).
      const conResultado = allTestResponses.filter(
        (tr) => tr.status === 'completed' || (tr.status === 'insufficient_answers' && !!tr.interpretation),
      ).length;
      if (conResultado === 0) {
        this.logger.warn(
          `WorkerProcess ${workerProcessId}: ningún test con respuestas suficientes. No se genera informe.`,
        );
        return;
      }

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
    testResponse.passed = this.alcanzaElPuntajeDeAprobacion(
      totalScore,
      maxScore,
      testResponse.test?.passingScore,
    );

    return this.testResponseRepository.save(testResponse);
  }

  /**
   * `passingScore` está guardado como PORCENTAJE (70, 75, 80 — y así lo
   * describen los propios tests: «Debes obtener al menos 80% para aprobar»),
   * pero se venía comparando contra el puntaje en PUNTOS. Con un test de 30
   * puntos y umbral 80, ni un 30/30 alcanzaba: `30 >= 80` es falso, así que
   * todo candidato salía «No Aprobado» con 100%. Se compara porcentaje contra
   * porcentaje.
   */
  private alcanzaElPuntajeDeAprobacion(
    totalScore: number,
    maxScore: number,
    passingScore?: number | null,
  ): boolean {
    if (passingScore === null || passingScore === undefined) return false;
    if (!maxScore) return false;
    return (totalScore / maxScore) * 100 >= passingScore;
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

      case FixedTestCode.TEST_CEAL:
        const cealResult =
          this.testCEALScoringService.calculateScore(testResponse.answers);
        testResponse.rawScores = cealResult.rawScores;
        testResponse.scaledScores = cealResult.scaledScores;
        testResponse.interpretation = cealResult.interpretation;
        this.logger.log(
          `CEAL Test evaluated: ${cealResult.interpretation.resultadoResumen}`,
        );
        break;

      case FixedTestCode.TEST_BIS11:
        const bis11Result =
          this.testBIS11ScoringService.calculateScore(testResponse.answers);
        testResponse.rawScores = bis11Result.rawScores;
        testResponse.scaledScores = bis11Result.scaledScores;
        testResponse.interpretation = bis11Result.interpretation;
        this.logger.log(
          `BIS-11 Test evaluated: ${bis11Result.interpretation.resultadoResumen}`,
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
      relations: [
        'test',
        'answers',
        'answers.question',
        'workerProcess',
        'workerProcess.worker',
        'workerProcess.process',
      ],
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
    testResponse.passed = this.alcanzaElPuntajeDeAprobacion(
      totalScore,
      maxScore,
      testResponse.test?.passingScore,
    );

    const savedTestResponse = await this.testResponseRepository.save(testResponse);

    // P-41: el puntaje de la postulación también tiene que moverse cuando el
    // evaluador corrige a mano, no solo cuando el candidato termina el test.
    await this.refrescarPuntajeDeLaPostulacion(
      testResponse.workerProcess?.id,
    );

    // Verificar si todas las respuestas han sido evaluadas
    const allEvaluated = testResponse.answers.every((answer) => answer.score !== null && answer.score !== undefined);

    // Notificar a los administradores solo si todas las respuestas están evaluadas
    if (allEvaluated) {
      try {
        const admins = await this.usersService.findAdminUsers();
        const adminIds = admins.map((admin) => admin.id);

        if (adminIds.length > 0) {
          await this.notificationsGateway.broadcastNotification(adminIds, {
            title: 'Evaluación completada',
            message: `Se ha completado la evaluación del test "${testResponse.test.name}" para ${testResponse.workerProcess.worker.firstName} ${testResponse.workerProcess.worker.lastName}`,
            type: NotificationType.EVALUATION_COMPLETED,
            link: `/admin/procesos/${testResponse.workerProcess.process.id}`,
          });
        }

        // Notificar también a los usuarios de la empresa
        if (testResponse.workerProcess.process.company?.id) {
          const companyUsers = await this.usersService.findCompanyUsers(
            testResponse.workerProcess.process.company.id
          );
          const companyUserIds = companyUsers.map((user) => user.id);

          if (companyUserIds.length > 0) {
            await this.notificationsGateway.broadcastNotification(companyUserIds, {
              title: 'Evaluación completada en tu proceso',
              message: `Se ha completado la evaluación del test "${testResponse.test.name}" para ${testResponse.workerProcess.worker.firstName} ${testResponse.workerProcess.worker.lastName}`,
              type: NotificationType.EVALUATION_COMPLETED,
              link: `/empresa/procesos/${testResponse.workerProcess.process.id}`,
            });
          }
        }

        // Notificar al trabajador sobre el resultado de su evaluación manual
        const workerUserId = testResponse.workerProcess.worker.user?.id;
        if (workerUserId) {
          const passed = testResponse.passed;
          await this.notificationsGateway.broadcastNotification([workerUserId], {
            title: passed ? 'Evaluación aprobada' : 'Evaluación completada',
            message: `Tu evaluación del test "${testResponse.test.name}" ha sido completada${passed ? ' y aprobada' : ''}`,
            type: passed ? NotificationType.SUCCESS : NotificationType.INFO,
            link: `/trabajador/postulaciones/${testResponse.workerProcess.id}`,
          });
        }
      } catch (error) {
        this.logger.error(
          `Error sending notification for completed evaluation: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return savedTestResponse;
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

    /**
     * Las preguntas de un test fijo se cargan sin ORDER BY, así que Postgres
     * puede devolverlas en cualquier orden, y el formulario las numera por
     * posición. En el CEAL eso cambiaría el «1. … 12.» del cuadernillo.
     */
    testResponse.fixedTest?.questions?.sort(
      (a, b) => a.questionNumber - b.questionNumber,
    );

    /**
     * El segundo control comentado con `// TEMPORARILY DISABLED FOR TESTING`.
     * Sin el, cualquier candidato podia leer las respuestas, el puntaje, el
     * perfil psicometrico y las notas del evaluador de otro candidato, que son
     * datos personales sensibles.
     *
     * La comprobacion se hace contra la postulacion y no solo contra el
     * candidato, porque este mismo endpoint lo consumen empresa, invitado y
     * evaluador, y ninguno de los tres tenia recorte tampoco.
     */
    await this.asegurarAccesoAPostulacion(
      testResponse.workerProcess.id,
      user,
      'este test',
    );

    /**
     * Un test reabierto a mano queda con `startedAt = NULL` para que su reloj
     * arranque cuando el candidato vuelva a entrar, no cuando se reabrió.
     * «Continuar Test» navega directo aquí sin pasar por /start, así que el
     * inicio se marca en esta lectura, solo si quien lee es el propio
     * candidato (no la empresa ni el admin mirando).
     */
    const esElCandidato =
      !!user?.id && user.id === testResponse.workerProcess?.worker?.user?.id;
    if (esElCandidato && !testResponse.isCompleted && !testResponse.startedAt) {
      testResponse.startedAt = new Date();
      await this.testResponseRepository.update(testResponse.id, {
        startedAt: testResponse.startedAt,
      });
    }

    return testResponse;
  }

  /**
   * El admin reabre un test que se cerró incompleto.
   *
   * Hace en un paso lo que el 21-11-2026 hubo que hacer a mano con SQL para
   * cinco 16PF cerrados por tiempo: las respuestas guardadas se conservan, el
   * reloj vuelve a arrancar cuando la persona entre (`startedAt = NULL`, ver
   * findOne), la postulación vuelve a «en proceso» y se borra el informe sin
   * aprobar que se generó con el test a medias.
   */
  async reactivarTest(
    id: string,
    dto: ReactivarTestDto,
  ): Promise<{ correoEnviado: boolean; correoError?: string; respuestasConservadas: number }> {
    const tr = await this.testResponseRepository.findOne({
      where: { id },
      relations: {
        test: true,
        fixedTest: true,
        workerProcess: { worker: { user: true }, process: { company: true } },
      },
    });
    if (!tr) throw new NotFoundException('No encontramos ese test.');

    if (tr.status !== 'insufficient_answers' && tr.status !== 'abandoned') {
      throw new BadRequestException(
        tr.isCompleted
          ? 'Solo se pueden reactivar tests incompletos. Este test se completó entero.'
          : 'Este test todavía está abierto: el postulante puede seguir respondiéndolo.',
      );
    }

    const wp = tr.workerProcess;
    const proceso = wp.process;
    if (proceso.status !== ProcessStatus.ACTIVE || procesoVencido(proceso.endDate)) {
      throw new BadRequestException(
        `El proceso "${proceso.name}" no está activo o ya pasó su fecha de término. Extiende la fecha de término del proceso y vuelve a intentarlo; si no, el cierre automático lo cerraría otra vez.`,
      );
    }

    const informes = (await this.reportsService.findByWorker(wp.worker.id)).filter(
      (r) => r.process?.id === proceso.id,
    );
    if (informes.some((r) => r.status === ReportStatus.APPROVED)) {
      throw new BadRequestException(
        'Esta postulación ya tiene un informe aprobado. Para reactivar el test, primero hay que devolver ese informe.',
      );
    }

    await this.testResponseRepository.update(tr.id, {
      isCompleted: false,
      status: null as unknown as string,
      completedAt: null as unknown as Date,
      startedAt: null as unknown as Date,
      score: null as unknown as number,
      passed: false,
      rawScores: null as unknown as Record<string, any>,
      scaledScores: null as unknown as Record<string, any>,
      interpretation: null as unknown as Record<string, any>,
      metadata: null as unknown as Record<string, any>,
    });
    for (const informe of informes) {
      await this.reportsService.remove(informe.id);
    }
    await this.workerProcessRepository.update(wp.id, {
      status: WorkerStatus.IN_PROCESS,
      totalScore: null as unknown as number,
    });

    const respuestasConservadas = await this.testAnswerRepository.count({
      where: { testResponse: { id: tr.id } },
    });
    this.logger.log(
      `Test ${tr.id} reactivado por admin (${respuestasConservadas} respuestas conservadas, ${informes.length} informes borrados)`,
    );

    if (!dto.enviarCorreo) return { correoEnviado: false, respuestasConservadas };

    const email = wp.worker.email || wp.worker.user?.email;
    if (!email) {
      return { correoEnviado: false, correoError: 'El postulante no tiene correo registrado.', respuestasConservadas };
    }
    try {
      const correo = buildTestReactivadoEmail({
        workerName: wp.worker.firstName,
        processName: proceso.name,
        companyName: proceso.company?.name ?? 'la empresa',
        position: proceso.position,
        testName: tr.fixedTest?.name ?? tr.test?.name ?? 'test',
        duracionMinutos: (tr.fixedTest?.duration ?? tr.test?.duration) || null,
        mensaje: dto.mensaje,
        fechaTermino: proceso.endDate,
      });
      await EmailHelper.sendEmail(email, correo.subject, correo.text, correo.html);
      return { correoEnviado: true, respuestasConservadas };
    } catch (error) {
      this.logger.error(`No se pudo enviar el correo de test reactivado: ${error instanceof Error ? error.message : String(error)}`);
      return {
        correoEnviado: false,
        correoError: 'El test quedó reactivado, pero el correo no se pudo enviar. Avísale por otro medio.',
        respuestasConservadas,
      };
    }
  }

  /**
   * El admin reinicia la participación de una persona en un proceso para que
   * rinda todos los tests de nuevo desde cero.
   *
   * A diferencia de `reactivarTest` (un test incompleto, conserva respuestas),
   * aquí se borran todos los tests de la postulación, sus respuestas y todos
   * los informes del proceso (también uno aprobado), y la postulación vuelve a
   * «pendiente». Los videos no se tocan.
   *
   * Antes de borrar, el intento anterior completo (puntajes y respuestas) queda
   * respaldado en la auditoría junto con quién reinició y por qué.
   */
  async reiniciarParticipacion(
    workerProcessId: string,
    dto: ReiniciarParticipacionDto,
    admin: { id?: string } | undefined,
  ): Promise<{
    testsBorrados: number;
    respuestasArchivadas: number;
    informesBorrados: number;
    correoEnviado: boolean;
    correoError?: string;
  }> {
    const wp = await this.workerProcessRepository.findOne({
      where: { id: workerProcessId },
      relations: {
        worker: { user: true },
        process: { company: true },
        testResponses: { test: true, fixedTest: true, answers: { question: true } },
      },
    });
    if (!wp) throw new NotFoundException('No encontramos esa postulación.');

    const proceso = wp.process;
    if (proceso.status !== ProcessStatus.ACTIVE || procesoVencido(proceso.endDate)) {
      throw new BadRequestException(
        `El proceso "${proceso.name}" no está activo o ya pasó su fecha de término. Extiende la fecha de término del proceso y vuelve a intentarlo; si no, la persona no podría rendir los tests.`,
      );
    }

    const tests = wp.testResponses ?? [];
    const informes = (await this.reportsService.findByWorker(wp.worker.id)).filter(
      (r) => r.process?.id === proceso.id,
    );
    if (tests.length === 0 && informes.length === 0) {
      throw new BadRequestException(
        'Esta postulación no tiene tests ni informes: no hay nada que reiniciar.',
      );
    }

    const respuestasArchivadas = tests.reduce((n, t) => n + (t.answers?.length ?? 0), 0);
    const respaldo = {
      postulacion: {
        id: wp.id,
        status: wp.status,
        totalScore: wp.totalScore,
        evaluatedAt: wp.evaluatedAt,
      },
      proceso: { id: proceso.id, name: proceso.name },
      tests: tests.map((t) => ({
        id: t.id,
        testId: t.test?.id ?? null,
        fixedTestId: t.fixedTest?.id ?? t.fixedTestId ?? null,
        nombre: t.fixedTest?.name ?? t.test?.name ?? null,
        status: t.status,
        isCompleted: t.isCompleted,
        startedAt: t.startedAt,
        completedAt: t.completedAt,
        score: t.score,
        maxScore: t.maxScore,
        passed: t.passed,
        rawScores: t.rawScores,
        scaledScores: t.scaledScores,
        interpretation: t.interpretation,
        evaluatorNotes: t.evaluatorNotes,
        respuestas: (t.answers ?? []).map((a) => ({
          questionId: a.question?.id ?? null,
          fixedTestQuestionId: a.fixedTestQuestionId ?? null,
          answer: a.answer,
          score: a.score,
          isCorrect: a.isCorrect,
          evaluatorComment: a.evaluatorComment,
        })),
      })),
      informes: informes.map((r) => ({ id: r.id, status: r.status })),
    };

    // El respaldo va primero: si falla, no se borra nada.
    await this.auditService.log(
      AuditAction.DELETE,
      'worker_process_reinicio',
      wp.id,
      admin?.id as string,
      {
        oldValues: respaldo,
        newValues: { status: WorkerStatus.PENDING },
        description: `Participación reiniciada por admin: ${tests.length} tests y ${informes.length} informes borrados. Motivo: ${dto.motivo}`,
      },
    );

    const idsTests = tests.map((t) => t.id);
    await this.testResponseRepository.manager.transaction(async (m) => {
      if (idsTests.length > 0) {
        await m
          .createQueryBuilder()
          .delete()
          .from(TestAnswer)
          .where('test_response_id IN (:...ids)', { ids: idsTests })
          .execute();
        await m.delete(TestResponse, idsTests);
      }
      await m.update(WorkerProcess, wp.id, {
        status: WorkerStatus.PENDING,
        totalScore: null as unknown as number,
        evaluatedAt: null as unknown as Date,
      });
    });
    for (const informe of informes) {
      await this.reportsService.remove(informe.id);
    }

    this.logger.log(
      `Postulación ${wp.id} reiniciada por admin (${tests.length} tests, ${respuestasArchivadas} respuestas archivadas, ${informes.length} informes borrados)`,
    );

    const resultado = {
      testsBorrados: tests.length,
      respuestasArchivadas,
      informesBorrados: informes.length,
    };
    if (!dto.enviarCorreo) return { ...resultado, correoEnviado: false };

    const email = wp.worker.email || wp.worker.user?.email;
    if (!email) {
      return { ...resultado, correoEnviado: false, correoError: 'La persona no tiene correo registrado.' };
    }
    try {
      const correo = buildParticipacionReiniciadaEmail({
        workerName: wp.worker.firstName,
        processName: proceso.name,
        companyName: proceso.company?.name ?? 'la empresa',
        position: proceso.position,
        mensaje: dto.mensaje,
        fechaTermino: proceso.endDate,
      });
      await EmailHelper.sendEmail(email, correo.subject, correo.text, correo.html);
      return { ...resultado, correoEnviado: true };
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el correo de participación reiniciada: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        ...resultado,
        correoEnviado: false,
        correoError: 'La participación quedó reiniciada, pero el correo no se pudo enviar. Avísale por otro medio.',
      };
    }
  }

  /**
   * El admin reinicia UN test de una persona dentro de un proceso.
   *
   * Es el término medio entre `reactivarTest` (conserva las respuestas, solo
   * tests incompletos) y `reiniciarParticipacion` (borra todos los tests):
   * sirve para cualquier test —completo, incompleto o abierto— y borra solo
   * ese. Se borra la fila entera, no solo las respuestas, para que al volver a
   * abrirlo nazca con otro id: el navegador del candidato guarda el avance por
   * id, y con el mismo id le devolvería las respuestas viejas.
   *
   * Los informes del proceso se borran (salieron con el intento anterior) y la
   * postulación vuelve a «en proceso» (o a «pendiente» si no le queda ningún
   * otro test). El intento anterior queda respaldado en la auditoría.
   */
  async reiniciarTest(
    id: string,
    dto: ReiniciarTestDto,
    admin: { id?: string } | undefined,
  ): Promise<{
    respuestasArchivadas: number;
    informesBorrados: number;
    correoEnviado: boolean;
    correoError?: string;
  }> {
    const tr = await this.testResponseRepository.findOne({
      where: { id },
      relations: {
        test: true,
        fixedTest: true,
        answers: { question: true },
        workerProcess: { worker: { user: true }, process: { company: true } },
      },
    });
    if (!tr) throw new NotFoundException('No encontramos ese test.');

    const wp = tr.workerProcess;
    const proceso = wp.process;
    if (proceso.status !== ProcessStatus.ACTIVE || procesoVencido(proceso.endDate)) {
      throw new BadRequestException(
        `El proceso "${proceso.name}" no está activo o ya pasó su fecha de término. Extiende la fecha de término del proceso y vuelve a intentarlo; si no, la persona no podría rendir el test.`,
      );
    }

    const informes = (await this.reportsService.findByWorker(wp.worker.id)).filter(
      (r) => r.process?.id === proceso.id,
    );
    const nombreTest = tr.fixedTest?.name ?? tr.test?.name ?? 'test';
    const respuestas = tr.answers ?? [];

    // El respaldo va primero: si falla, no se borra nada.
    await this.auditService.log(
      AuditAction.DELETE,
      'test_response_reinicio',
      tr.id,
      admin?.id as string,
      {
        oldValues: {
          postulacion: { id: wp.id, status: wp.status, totalScore: wp.totalScore, evaluatedAt: wp.evaluatedAt },
          proceso: { id: proceso.id, name: proceso.name },
          test: {
            id: tr.id,
            testId: tr.test?.id ?? null,
            fixedTestId: tr.fixedTest?.id ?? tr.fixedTestId ?? null,
            nombre: nombreTest,
            status: tr.status,
            isCompleted: tr.isCompleted,
            startedAt: tr.startedAt,
            completedAt: tr.completedAt,
            score: tr.score,
            maxScore: tr.maxScore,
            passed: tr.passed,
            rawScores: tr.rawScores,
            scaledScores: tr.scaledScores,
            interpretation: tr.interpretation,
            metadata: tr.metadata,
            evaluatorNotes: tr.evaluatorNotes,
            respuestas: respuestas.map((a) => ({
              questionId: a.question?.id ?? null,
              fixedTestQuestionId: a.fixedTestQuestionId ?? null,
              answer: a.answer,
              score: a.score,
              isCorrect: a.isCorrect,
              evaluatorComment: a.evaluatorComment,
            })),
          },
          informes: informes.map((r) => ({ id: r.id, status: r.status })),
        },
        description: `Test "${nombreTest}" reiniciado por admin (${respuestas.length} respuestas, ${informes.length} informes borrados). Motivo: ${dto.motivo}`,
      },
    );

    await this.testResponseRepository.manager.transaction(async (m) => {
      await m
        .createQueryBuilder()
        .delete()
        .from(TestAnswer)
        .where('test_response_id = :id', { id: tr.id })
        .execute();
      await m.delete(TestResponse, tr.id);
      const quedan = await m.count(TestResponse, { where: { workerProcess: { id: wp.id } } });
      await m.update(WorkerProcess, wp.id, {
        status: quedan > 0 ? WorkerStatus.IN_PROCESS : WorkerStatus.PENDING,
        totalScore: null as unknown as number,
        evaluatedAt: null as unknown as Date,
      });
    });
    for (const informe of informes) {
      await this.reportsService.remove(informe.id);
    }

    this.logger.log(
      `Test ${tr.id} (${nombreTest}) reiniciado por admin (${respuestas.length} respuestas archivadas, ${informes.length} informes borrados)`,
    );

    const resultado = { respuestasArchivadas: respuestas.length, informesBorrados: informes.length };
    if (!dto.enviarCorreo) return { ...resultado, correoEnviado: false };

    const email = wp.worker.email || wp.worker.user?.email;
    if (!email) {
      return { ...resultado, correoEnviado: false, correoError: 'La persona no tiene correo registrado.' };
    }
    try {
      const correo = buildTestReiniciadoEmail({
        workerName: wp.worker.firstName,
        processName: proceso.name,
        companyName: proceso.company?.name ?? 'la empresa',
        position: proceso.position,
        testName: nombreTest,
        duracionMinutos: (tr.fixedTest?.duration ?? tr.test?.duration) || null,
        mensaje: dto.mensaje,
        fechaTermino: proceso.endDate,
      });
      await EmailHelper.sendEmail(email, correo.subject, correo.text, correo.html);
      return { ...resultado, correoEnviado: true };
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el correo de test reiniciado: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        ...resultado,
        correoEnviado: false,
        correoError: 'El test quedó reiniciado, pero el correo no se pudo enviar. Avísale por otro medio.',
      };
    }
  }

  async findByWorkerProcess(
    workerProcessId: string,
    user?: any,
  ): Promise<TestResponse[]> {
    /**
     * Este endpoint no tenia control de ningun tipo, ni siquiera comentado: el
     * metodo ni recibia quien preguntaba. Con el UUID de una postulacion
     * cualquiera se leian todas sus respuestas de test.
     */
    await this.asegurarAccesoAPostulacion(workerProcessId, user, 'esta postulación');

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
   * P-66. Guarda las notas generales del evaluador sobre una respuesta de test.
   */
  async saveEvaluatorNotes(
    id: string,
    dto: { evaluatorNotes?: string },
  ): Promise<TestResponse> {
    const testResponse = await this.testResponseRepository.findOne({
      where: { id },
    });

    if (!testResponse) {
      throw new NotFoundException(`Respuesta de test ${id} no encontrada`);
    }

    testResponse.evaluatorNotes = dto.evaluatorNotes ?? null;
    return this.testResponseRepository.save(testResponse);
  }

  /**
   * P-41. Puntaje de la postulación, a partir de los tests que rindió.
   *
   * PENDIENTE DE DEFINICIÓN CON LA CLIENTA: qué número quiere ver en la tabla
   * de candidatos. Se implementa el PORCENTAJE PROMEDIO porque es lo único
   * defendible sin esa respuesta: sumar los puntajes brutos de tests con
   * escalas distintas (uno sobre 40, otro sobre 100) da un número que no
   * significa nada y que no permite comparar a dos candidatos entre sí.
   *
   * Si la clienta prefiere el bruto o un promedio ponderado por test, se
   * cambia aquí y solo aquí.
   */
  private async calcularPuntajeDeLaPostulacion(
    workerProcessId: string,
  ): Promise<number | null> {
    const respuestas = await this.testResponseRepository.find({
      where: { workerProcess: { id: workerProcessId } },
    });

    // Solo cuentan las que tienen escala: sin maxScore no hay porcentaje que
    // calcular (es el caso de los tests psicométricos, que no se puntúan
    // sobre un total sino por factores).
    const conEscala = respuestas.filter(
      (r) => r.maxScore != null && r.maxScore > 0 && r.score != null,
    );

    if (conEscala.length === 0) return null;

    const suma = conEscala.reduce(
      (acc, r) => acc + (r.score / r.maxScore) * 100,
      0,
    );

    return Math.round(suma / conEscala.length);
  }

  /**
   * Recalcula y guarda el puntaje de la postulación.
   * Que falle no puede tumbar la evaluación que se acaba de guardar.
   */
  private async refrescarPuntajeDeLaPostulacion(
    workerProcessId?: string,
  ): Promise<void> {
    if (!workerProcessId) return;

    try {
      const puntaje =
        await this.calcularPuntajeDeLaPostulacion(workerProcessId);

      if (puntaje !== null) {
        await this.workerProcessRepository.update(workerProcessId, {
          totalScore: puntaje,
        });
      }
    } catch (error) {
      this.logger.error(
        `No se pudo actualizar el puntaje de la postulación ${workerProcessId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
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
        relations: ['process', 'process.tests', 'process.fixedTests', 'process.company', 'worker', 'worker.user'],
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
        // P-41: aquí decía `= 0; // Will be calculated from test scores`. Ese
        // cálculo nunca se escribió, así que la columna Puntaje de la tabla de
        // candidatos salía siempre vacía por más tests que rindiera la persona.
        workerProcess.totalScore =
          await this.calcularPuntajeDeLaPostulacion(workerProcessId);
        await this.workerProcessRepository.save(workerProcess);
        this.logger.log(
          `WorkerProcess ${workerProcessId} status updated to 'completed' after completing ${completedTestCount}/${totalRequiredTests} tests`,
        );

        // Send email notification that all tests are completed
        try {
          if (workerProcess.worker?.user?.email) {
            const workerName = `${workerProcess.worker.user.firstName} ${workerProcess.worker.user.lastName}`;
            const processName = workerProcess.process.name;
            const companyName = workerProcess.process.company?.name || 'la empresa';
            const position = workerProcess.process.position || processName;

            await this.sendTestsCompletedEmail(
              workerProcess.worker.user.email,
              workerName,
              processName,
              companyName,
              position,
              completedTestCount,
            );
          }
        } catch (emailError) {
          this.logger.error(`Failed to send tests completed email: ${emailError.message}`);
        }
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

  /**
   * Correo al completar la última evaluación del proceso: qué sigue y dónde
   * ver el estado de la postulación. Contenido en common/helpers/worker-emails.ts.
   */
  private async sendTestsCompletedEmail(
    email: string,
    workerName: string,
    processName: string,
    companyName: string,
    position: string,
    testsCompleted: number,
  ): Promise<void> {
    const correo = buildTestsCompletedEmail({
      workerName,
      processName,
      companyName,
      position,
      testsCompleted,
    });

    await EmailHelper.sendEmail(email, correo.subject, correo.text, correo.html);
  }
}
