import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThan, IsNull } from 'typeorm';
import { SelectionProcess } from '../processes/entities/selection-process.entity';
import { WorkerProcess } from '../workers/entities/worker-process.entity';
import { TestResponse } from '../test-responses/entities/test-response.entity';
import { ProcessStatus } from '../../common/enums/process-status.enum';
import { WorkerStatus } from '../../common/enums/worker-status.enum';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { UsersService } from '../users/users.service';

@Injectable()
export class NotificationsSchedulerService {
  private readonly logger = new Logger(NotificationsSchedulerService.name);

  constructor(
    @InjectRepository(SelectionProcess)
    private readonly processRepository: Repository<SelectionProcess>,
    @InjectRepository(WorkerProcess)
    private readonly workerProcessRepository: Repository<WorkerProcess>,
    @InjectRepository(TestResponse)
    private readonly testResponseRepository: Repository<TestResponse>,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Cron job: Notificar procesos próximos a vencer (7 días antes)
   * Se ejecuta todos los días a las 9:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM, {
    name: 'notifyProcessesAboutToExpire',
  })
  async notifyProcessesAboutToExpire() {
    this.logger.log('Running cron: notifyProcessesAboutToExpire');

    try {
      const now = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(now.getDate() + 7);

      // Buscar procesos activos que vencen en los próximos 7 días
      const expiringProcesses = await this.processRepository.find({
        where: {
          status: ProcessStatus.ACTIVE,
          endDate: LessThanOrEqual(sevenDaysFromNow),
        },
        relations: ['company', 'company.users'],
      });

      for (const process of expiringProcesses) {
        const daysUntilExpiration = Math.ceil(
          (process.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Solo notificar si está a 7, 3 o 1 día(s) de vencer
        if (![7, 3, 1].includes(daysUntilExpiration)) {
          continue;
        }

        try {
          // Notificar a los usuarios de la empresa
          const companyUsers = await this.usersService.findCompanyUsers(
            process.company.id,
          );
          const companyUserIds = companyUsers.map((user) => user.id);

          if (companyUserIds.length > 0) {
            await this.notificationsGateway.broadcastNotification(
              companyUserIds,
              {
                title: 'Proceso próximo a vencer',
                message: `El proceso "${process.name}" vence en ${daysUntilExpiration} día${daysUntilExpiration > 1 ? 's' : ''}`,
                type: NotificationType.WARNING,
                link: `/empresa/procesos/${process.id}`,
              },
            );

            this.logger.log(
              `Notified company users about process ${process.name} expiring in ${daysUntilExpiration} days`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to notify about expiring process ${process.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Cron job notifyProcessesAboutToExpire failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Cron job: Notificar a trabajadores sobre procesos próximos a cerrar
   * Se ejecuta todos los días a las 9:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM, {
    name: 'notifyWorkersAboutClosingProcesses',
  })
  async notifyWorkersAboutClosingProcesses() {
    this.logger.log('Running cron: notifyWorkersAboutClosingProcesses');

    try {
      const now = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(now.getDate() + 7);

      // Buscar WorkerProcess activos con procesos que cierran pronto
      const workerProcesses = await this.workerProcessRepository.find({
        where: {
          status: WorkerStatus.IN_PROCESS,
          process: {
            status: ProcessStatus.ACTIVE,
            endDate: LessThanOrEqual(sevenDaysFromNow),
          },
        },
        relations: ['worker', 'worker.user', 'process'],
      });

      for (const workerProcess of workerProcesses) {
        const daysUntilClosure = Math.ceil(
          (workerProcess.process.endDate.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        // Solo notificar si está a 7, 3 o 1 día(s) de cerrar
        if (![7, 3, 1].includes(daysUntilClosure)) {
          continue;
        }

        try {
          const workerUserId = workerProcess.worker.user?.id;
          if (workerUserId) {
            await this.notificationsGateway.broadcastNotification(
              [workerUserId],
              {
                title: 'Proceso próximo a cerrar',
                message: `El proceso "${workerProcess.process.name}" cierra en ${daysUntilClosure} día${daysUntilClosure > 1 ? 's' : ''}. Completa tus tests pendientes.`,
                type: NotificationType.WARNING,
                link: `/trabajador/procesos/${workerProcess.process.id}`,
              },
            );

            this.logger.log(
              `Notified worker ${workerProcess.worker.firstName} about process ${workerProcess.process.name} closing in ${daysUntilClosure} days`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to notify worker about closing process: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Cron job notifyWorkersAboutClosingProcesses failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Cron job: Notificar a trabajadores sobre tests próximos a vencer
   * Se ejecuta todos los días a las 10:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_10AM, {
    name: 'notifyWorkersAboutExpiringTests',
  })
  async notifyWorkersAboutExpiringTests() {
    this.logger.log('Running cron: notifyWorkersAboutExpiringTests');

    try {
      const now = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(now.getDate() + 3);

      // Buscar test responses no completados en procesos activos próximos a vencer
      const testResponses = await this.testResponseRepository.find({
        where: {
          isCompleted: false,
          workerProcess: {
            status: WorkerStatus.IN_PROCESS,
            process: {
              status: ProcessStatus.ACTIVE,
              endDate: LessThanOrEqual(threeDaysFromNow),
            },
          },
        },
        relations: [
          'workerProcess',
          'workerProcess.worker',
          'workerProcess.worker.user',
          'workerProcess.process',
          'test',
          'fixedTest',
        ],
      });

      // Agrupar por trabajador para enviar una sola notificación con todos los tests pendientes
      const notificationsByWorker = new Map<string, any>();

      for (const testResponse of testResponses) {
        const workerUserId = testResponse.workerProcess.worker.user?.id;
        if (!workerUserId) continue;

        const testName = testResponse.test?.name || testResponse.fixedTest?.name;
        const processName = testResponse.workerProcess.process.name;
        const daysUntilExpiration = Math.ceil(
          (testResponse.workerProcess.process.endDate.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        if (!notificationsByWorker.has(workerUserId)) {
          notificationsByWorker.set(workerUserId, {
            tests: [],
            processId: testResponse.workerProcess.process.id,
            processName,
            daysUntilExpiration,
          });
        }

        notificationsByWorker.get(workerUserId).tests.push(testName);
      }

      // Enviar notificaciones
      for (const [workerUserId, data] of notificationsByWorker.entries()) {
        try {
          const testCount = data.tests.length;
          await this.notificationsGateway.broadcastNotification(
            [workerUserId],
            {
              title: 'Tests pendientes próximos a vencer',
              message: `Tienes ${testCount} test${testCount > 1 ? 's' : ''} pendiente${testCount > 1 ? 's' : ''} en "${data.processName}". El proceso cierra en ${data.daysUntilExpiration} día${data.daysUntilExpiration > 1 ? 's' : ''}.`,
              type: NotificationType.WARNING,
              link: `/trabajador/procesos/${data.processId}/tests`,
            },
          );

          this.logger.log(
            `Notified worker about ${testCount} expiring test(s) in process ${data.processName}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to notify worker about expiring tests: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Cron job notifyWorkersAboutExpiringTests failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Cron job: Notificar a evaluadores sobre tests pendientes de evaluación
   * Se ejecuta todos los días a las 11:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_11AM, {
    name: 'notifyEvaluatorsAboutPendingTests',
  })
  async notifyEvaluatorsAboutPendingTests() {
    this.logger.log('Running cron: notifyEvaluatorsAboutPendingTests');

    try {
      const now = new Date();
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(now.getDate() - 3);

      // Buscar test responses completados hace más de 3 días que requieren evaluación manual
      const pendingTests = await this.testResponseRepository.find({
        where: {
          isCompleted: true,
          completedAt: LessThanOrEqual(threeDaysAgo),
          test: {
            requiresManualReview: true,
          },
          workerProcess: {
            process: {
              status: ProcessStatus.ACTIVE,
            },
          },
        },
        relations: [
          'test',
          'answers',
          'workerProcess',
          'workerProcess.worker',
          'workerProcess.process',
          'workerProcess.process.evaluators',
        ],
      });

      // Filtrar solo los que tienen respuestas sin evaluar
      const testsNeedingEvaluation = pendingTests.filter((testResponse) => {
        return testResponse.answers.some(
          (answer) => answer.score === null || answer.score === undefined,
        );
      });

      // Agrupar por evaluador
      const notificationsByEvaluator = new Map<string, any[]>();

      for (const testResponse of testsNeedingEvaluation) {
        const evaluators = testResponse.workerProcess.process.evaluators || [];

        for (const evaluator of evaluators) {
          if (!notificationsByEvaluator.has(evaluator.id)) {
            notificationsByEvaluator.set(evaluator.id, []);
          }

          notificationsByEvaluator.get(evaluator.id).push({
            testName: testResponse.test.name,
            workerName: `${testResponse.workerProcess.worker.firstName} ${testResponse.workerProcess.worker.lastName}`,
            processName: testResponse.workerProcess.process.name,
            responseId: testResponse.id,
            daysWaiting: Math.floor(
              (now.getTime() - testResponse.completedAt.getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          });
        }
      }

      // Enviar notificaciones
      for (const [evaluatorId, tests] of notificationsByEvaluator.entries()) {
        try {
          const testCount = tests.length;
          const oldestTest = tests.reduce((oldest, current) =>
            current.daysWaiting > oldest.daysWaiting ? current : oldest,
          );

          await this.notificationsGateway.broadcastNotification([evaluatorId], {
            title: 'Tests pendientes de evaluación',
            message: `Tienes ${testCount} test${testCount > 1 ? 's' : ''} pendiente${testCount > 1 ? 's' : ''} de evaluación. El más antiguo lleva ${oldestTest.daysWaiting} días esperando.`,
            type: NotificationType.WARNING,
            link: `/evaluador/evaluaciones`,
          });

          this.logger.log(
            `Notified evaluator about ${testCount} pending test(s) for evaluation`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to notify evaluator about pending tests: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Cron job notifyEvaluatorsAboutPendingTests failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Cron job: Notificar a evaluadores sobre evaluaciones urgentes (más de 7 días sin evaluar)
   * Se ejecuta todos los días a las 2:00 PM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2PM, {
    name: 'notifyEvaluatorsAboutUrgentEvaluations',
  })
  async notifyEvaluatorsAboutUrgentEvaluations() {
    this.logger.log('Running cron: notifyEvaluatorsAboutUrgentEvaluations');

    try {
      const now = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);

      // Buscar test responses completados hace más de 7 días que requieren evaluación manual
      const urgentTests = await this.testResponseRepository.find({
        where: {
          isCompleted: true,
          completedAt: LessThanOrEqual(sevenDaysAgo),
          test: {
            requiresManualReview: true,
          },
          workerProcess: {
            process: {
              status: ProcessStatus.ACTIVE,
            },
          },
        },
        relations: [
          'test',
          'answers',
          'workerProcess',
          'workerProcess.worker',
          'workerProcess.process',
          'workerProcess.process.evaluators',
        ],
      });

      // Filtrar solo los que tienen respuestas sin evaluar
      const testsNeedingUrgentEvaluation = urgentTests.filter((testResponse) => {
        return testResponse.answers.some(
          (answer) => answer.score === null || answer.score === undefined,
        );
      });

      // Agrupar por evaluador
      const notificationsByEvaluator = new Map<string, any[]>();

      for (const testResponse of testsNeedingUrgentEvaluation) {
        const evaluators = testResponse.workerProcess.process.evaluators || [];

        for (const evaluator of evaluators) {
          if (!notificationsByEvaluator.has(evaluator.id)) {
            notificationsByEvaluator.set(evaluator.id, []);
          }

          notificationsByEvaluator.get(evaluator.id).push({
            testName: testResponse.test.name,
            workerName: `${testResponse.workerProcess.worker.firstName} ${testResponse.workerProcess.worker.lastName}`,
            processName: testResponse.workerProcess.process.name,
            responseId: testResponse.id,
            daysWaiting: Math.floor(
              (now.getTime() - testResponse.completedAt.getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          });
        }
      }

      // Enviar notificaciones urgentes
      for (const [evaluatorId, tests] of notificationsByEvaluator.entries()) {
        try {
          const testCount = tests.length;
          const oldestTest = tests.reduce((oldest, current) =>
            current.daysWaiting > oldest.daysWaiting ? current : oldest,
          );

          await this.notificationsGateway.broadcastNotification([evaluatorId], {
            title: '⚠️ Evaluaciones urgentes pendientes',
            message: `Tienes ${testCount} evaluación${testCount > 1 ? 'es' : ''} URGENTE${testCount > 1 ? 'S' : ''} pendiente${testCount > 1 ? 's' : ''}. La más antigua lleva ${oldestTest.daysWaiting} días sin evaluar.`,
            type: NotificationType.ERROR,
            link: `/evaluador/evaluaciones/${oldestTest.responseId}`,
          });

          this.logger.log(
            `Notified evaluator about ${testCount} urgent evaluation(s)`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to notify evaluator about urgent evaluations: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Cron job notifyEvaluatorsAboutUrgentEvaluations failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
