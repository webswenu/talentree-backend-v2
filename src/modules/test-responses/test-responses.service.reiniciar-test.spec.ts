import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TestResponsesService } from './test-responses.service';
import { TestResponse } from './entities/test-response.entity';
import { WorkerProcess } from '../workers/entities/worker-process.entity';
import { WorkerStatus } from '../../common/enums/worker-status.enum';
import { ProcessStatus } from '../../common/enums/process-status.enum';
import { ReportStatus } from '../../common/enums/report-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuditAction } from '../../common/enums/audit-action.enum';
import { EmailHelper } from '../../common/helpers/email.helper';

/**
 * El admin reinicia UN test de una persona: se borra esa fila con sus
 * respuestas, los informes del proceso, y la postulación vuelve a «en
 * proceso». Los otros tests no se tocan.
 */
describe('TestResponsesService.reiniciarTest', () => {
  let tr: any;
  let informes: any[];
  let pasos: string[];
  let quedan: number;
  let servicio: TestResponsesService;
  let audit: { log: jest.Mock };
  let reports: { findByWorker: jest.Mock; remove: jest.Mock };
  let borrado: string | null;
  let actualizacionWp: any;

  const admin = { id: 'admin-1', role: UserRole.ADMIN_TALENTREE };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-26T15:00:00Z'));
    pasos = [];
    quedan = 2;
    borrado = null;
    actualizacionWp = null;
    tr = {
      id: 'tr-ic',
      status: 'completed',
      isCompleted: true,
      fixedTest: { id: 'ft-ic', name: 'Test IC', duration: 12 },
      answers: [{ answer: { column1: [1, 3] }, fixedTestQuestionId: 'q1' }],
      workerProcess: {
        id: 'wp-1',
        status: WorkerStatus.COMPLETED,
        worker: { id: 'w-1', firstName: 'Ana', email: 'ana@example.com', user: { id: 'u-1' } },
        process: {
          id: 'p-1',
          name: 'Operador',
          position: 'Operador de planta',
          status: ProcessStatus.ACTIVE,
          endDate: '2026-12-31',
          company: { name: 'Minera' },
        },
      },
    };
    informes = [
      { id: 'r-1', status: ReportStatus.PENDING_APPROVAL, process: { id: 'p-1' } },
      { id: 'r-otro', status: ReportStatus.APPROVED, process: { id: 'p-otro' } },
    ];

    const manager: any = {
      createQueryBuilder: () => {
        const qb: any = {
          delete: () => qb,
          from: () => qb,
          where: () => qb,
          execute: async () => {
            pasos.push('borrar-respuestas');
          },
        };
        return qb;
      },
      delete: jest.fn(async (entidad: unknown, id: string) => {
        expect(entidad).toBe(TestResponse);
        borrado = id;
        pasos.push('borrar-test');
      }),
      count: jest.fn(async () => quedan),
      update: jest.fn(async (entidad: unknown, id: string, cambios: any) => {
        expect(entidad).toBe(WorkerProcess);
        actualizacionWp = { id, cambios };
        pasos.push('actualizar-postulacion');
      }),
    };
    const trRepo: any = {
      findOne: jest.fn(async () => tr),
      manager: { transaction: async (cb: (m: any) => Promise<void>) => cb(manager) },
    };
    reports = {
      findByWorker: jest.fn(async () => informes),
      remove: jest.fn(async (id: string) => {
        pasos.push(`borrar-informe:${id}`);
      }),
    };
    audit = {
      log: jest.fn(async () => {
        pasos.push('respaldo');
      }),
    };
    const nada = {} as any;
    servicio = new TestResponsesService(
      trRepo,
      nada,
      nada,
      nada,
      reports as any,
      nada, nada, nada, nada, nada, nada, nada, nada,
      nada,
      nada,
      audit as any,
    );
    jest.spyOn(servicio['logger'], 'log').mockImplementation(() => undefined);
    jest.spyOn(servicio['logger'], 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('respalda primero, borra solo ese test y deja la postulación en proceso', async () => {
    const r = await servicio.reiniciarTest('tr-ic', { motivo: 'Se le cortó la luz' }, admin);

    expect(pasos).toEqual([
      'respaldo',
      'borrar-respuestas',
      'borrar-test',
      'actualizar-postulacion',
      'borrar-informe:r-1',
    ]);
    expect(borrado).toBe('tr-ic');
    expect(actualizacionWp).toEqual({
      id: 'wp-1',
      cambios: { status: WorkerStatus.IN_PROCESS, totalScore: null, evaluatedAt: null },
    });
    expect(r).toEqual({ respuestasArchivadas: 1, informesBorrados: 1, correoEnviado: false });

    const [accion, entidad, id, quien, datos] = audit.log.mock.calls[0];
    expect(accion).toBe(AuditAction.DELETE);
    expect(entidad).toBe('test_response_reinicio');
    expect(id).toBe('tr-ic');
    expect(quien).toBe('admin-1');
    expect(datos.oldValues.test.respuestas).toHaveLength(1);
    expect(datos.description).toContain('Se le cortó la luz');
  });

  it('si no le queda ningún otro test, la postulación vuelve a pendiente', async () => {
    quedan = 0;
    await servicio.reiniciarTest('tr-ic', { motivo: 'motivo' }, admin);
    expect(actualizacionWp.cambios.status).toBe(WorkerStatus.PENDING);
  });

  it('sirve también para un test abierto que nunca se envió', async () => {
    tr.status = null;
    tr.isCompleted = false;
    tr.answers = [];
    await expect(servicio.reiniciarTest('tr-ic', { motivo: 'motivo' }, admin)).resolves.toMatchObject({
      respuestasArchivadas: 0,
    });
  });

  it('no toca nada si el proceso venció', async () => {
    tr.workerProcess.process.endDate = '2026-11-20';
    await expect(servicio.reiniciarTest('tr-ic', { motivo: 'motivo' }, admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(pasos).toEqual([]);
  });

  it('no toca nada si el respaldo falla', async () => {
    audit.log.mockRejectedValueOnce(new Error('sin base'));
    await expect(servicio.reiniciarTest('tr-ic', { motivo: 'motivo' }, admin)).rejects.toThrow('sin base');
    expect(pasos).toEqual([]);
  });

  it('404 si el test no existe', async () => {
    tr = null;
    await expect(servicio.reiniciarTest('x', { motivo: 'motivo' }, admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('manda el correo si se pide', async () => {
    const envio = jest.spyOn(EmailHelper, 'sendEmail').mockResolvedValue(undefined as any);
    const r = await servicio.reiniciarTest('tr-ic', { motivo: 'motivo', enviarCorreo: true, mensaje: 'Suerte' }, admin);
    expect(r.correoEnviado).toBe(true);
    const [para, asunto, , html] = envio.mock.calls[0];
    expect(para).toBe('ana@example.com');
    expect(asunto).toContain('Test IC');
    expect(html).toContain('12 minutos');
    expect(html).toContain('Suerte');
  });
});
