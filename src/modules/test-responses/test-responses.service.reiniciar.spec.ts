import { BadRequestException, ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TestResponsesService } from './test-responses.service';
import { TestResponsesController } from './test-responses.controller';
import { TestResponse } from './entities/test-response.entity';
import { WorkerProcess } from '../workers/entities/worker-process.entity';
import { WorkerStatus } from '../../common/enums/worker-status.enum';
import { ProcessStatus } from '../../common/enums/process-status.enum';
import { ReportStatus } from '../../common/enums/report-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuditAction } from '../../common/enums/audit-action.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { EmailHelper } from '../../common/helpers/email.helper';

/**
 * El admin reinicia la participación de una persona en un proceso: se borran
 * todos sus tests (y sus informes) para que los rinda de nuevo desde cero, y
 * el intento anterior queda respaldado en la auditoría.
 */
describe('TestResponsesService.reiniciarParticipacion', () => {
  let wp: any;
  let informes: any[];
  let pasos: string[];
  let servicio: TestResponsesService;
  let audit: { log: jest.Mock };
  let reports: { findByWorker: jest.Mock; remove: jest.Mock };
  let borradoRespuestas: { ids: string[] } | null;
  let borradoTests: string[] | null;
  let actualizacionWp: { id: string; cambios: any } | null;

  const admin = { id: 'admin-1', role: UserRole.ADMIN_TALENTREE };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-26T15:00:00Z'));
    pasos = [];
    borradoRespuestas = null;
    borradoTests = null;
    actualizacionWp = null;
    wp = {
      id: 'wp-1',
      status: WorkerStatus.COMPLETED,
      totalScore: 72,
      evaluatedAt: '2026-11-25',
      worker: { id: 'w-1', firstName: 'Ana', email: 'ana@example.com', user: { id: 'u-1' } },
      process: {
        id: 'p-1',
        name: 'Operador',
        position: 'Operador de planta',
        status: ProcessStatus.ACTIVE,
        endDate: '2026-12-31',
        company: { name: 'Minera' },
      },
      testResponses: [
        {
          id: 'tr-1',
          status: 'completed',
          isCompleted: true,
          score: 40,
          fixedTest: { id: 'ft-16pf', name: '16PF' },
          answers: [
            { answer: 'a', score: 1, fixedTestQuestionId: 'q1' },
            { answer: 'b', score: 2, fixedTestQuestionId: 'q2' },
          ],
        },
        {
          id: 'tr-2',
          status: 'insufficient_answers',
          isCompleted: true,
          test: { id: 't-1', name: 'Test propio' },
          answers: [{ answer: 'x', score: 0, question: { id: 'q9' } }],
        },
      ],
    };
    informes = [
      { id: 'r-1', status: ReportStatus.APPROVED, process: { id: 'p-1' } },
      { id: 'r-otro', status: ReportStatus.PENDING_APPROVAL, process: { id: 'p-otro' } },
    ];

    const manager: any = {
      createQueryBuilder: () => {
        const qb: any = {
          delete: () => qb,
          from: () => qb,
          where: (_: string, params: { ids: string[] }) => {
            borradoRespuestas = params;
            return qb;
          },
          execute: async () => {
            pasos.push('borrar-respuestas');
          },
        };
        return qb;
      },
      delete: jest.fn(async (entidad: unknown, ids: string[]) => {
        expect(entidad).toBe(TestResponse);
        borradoTests = ids;
        pasos.push('borrar-tests');
      }),
      update: jest.fn(async (entidad: unknown, id: string, cambios: any) => {
        expect(entidad).toBe(WorkerProcess);
        actualizacionWp = { id, cambios };
        pasos.push('actualizar-postulacion');
      }),
    };
    const trRepo: any = {
      manager: { transaction: async (cb: (m: any) => Promise<void>) => cb(manager) },
    };
    const wpRepo: any = { findOne: jest.fn(async () => wp) };
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
      wpRepo,
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

  it('borra todos los tests y respuestas, todos los informes del proceso y deja la postulación pendiente', async () => {
    const r = await servicio.reiniciarParticipacion('wp-1', { motivo: 'Lo pidió la empresa' }, admin);

    expect(borradoRespuestas).toEqual({ ids: ['tr-1', 'tr-2'] });
    expect(borradoTests).toEqual(['tr-1', 'tr-2']);
    expect(actualizacionWp).toEqual({
      id: 'wp-1',
      cambios: { status: WorkerStatus.PENDING, totalScore: null, evaluatedAt: null },
    });
    // También el informe aprobado; el de otro proceso no se toca.
    expect(reports.remove).toHaveBeenCalledTimes(1);
    expect(reports.remove).toHaveBeenCalledWith('r-1');
    expect(r).toEqual({
      testsBorrados: 2,
      respuestasArchivadas: 3,
      informesBorrados: 1,
      correoEnviado: false,
    });
  });

  it('respalda el intento anterior en la auditoría antes de borrar nada', async () => {
    await servicio.reiniciarParticipacion('wp-1', { motivo: 'Se cortó la luz' }, admin);

    expect(pasos[0]).toBe('respaldo');
    const [accion, tipo, id, usuario, opciones] = audit.log.mock.calls[0] as any[];
    expect(accion).toBe(AuditAction.DELETE);
    expect(tipo).toBe('worker_process_reinicio');
    expect(id).toBe('wp-1');
    expect(usuario).toBe('admin-1');
    expect(opciones.description).toContain('Se cortó la luz');
    expect(opciones.oldValues.postulacion).toMatchObject({ status: WorkerStatus.COMPLETED, totalScore: 72 });
    expect(opciones.oldValues.tests).toHaveLength(2);
    expect(opciones.oldValues.tests[0]).toMatchObject({ nombre: '16PF', score: 40, fixedTestId: 'ft-16pf' });
    expect(opciones.oldValues.tests[0].respuestas).toEqual([
      expect.objectContaining({ fixedTestQuestionId: 'q1', answer: 'a', score: 1 }),
      expect.objectContaining({ fixedTestQuestionId: 'q2', answer: 'b', score: 2 }),
    ]);
    expect(opciones.oldValues.tests[1].respuestas[0]).toMatchObject({ questionId: 'q9', answer: 'x' });
    expect(opciones.oldValues.informes).toEqual([{ id: 'r-1', status: ReportStatus.APPROVED }]);
  });

  it('si el respaldo falla, no borra nada', async () => {
    audit.log.mockRejectedValueOnce(new Error('BD caída'));

    await expect(
      servicio.reiniciarParticipacion('wp-1', { motivo: 'prueba' }, admin),
    ).rejects.toThrow('BD caída');
    expect(borradoTests).toBeNull();
    expect(actualizacionWp).toBeNull();
    expect(reports.remove).not.toHaveBeenCalled();
  });

  it('postulación inexistente -> 404', async () => {
    wp = null;
    await expect(
      servicio.reiniciarParticipacion('wp-x', { motivo: 'prueba' }, admin),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('proceso cerrado o vencido -> rechaza sin tocar nada', async () => {
    wp.process.endDate = '2026-11-20';
    await expect(
      servicio.reiniciarParticipacion('wp-1', { motivo: 'prueba' }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);

    wp.process.endDate = '2026-12-31';
    wp.process.status = ProcessStatus.COMPLETED;
    await expect(
      servicio.reiniciarParticipacion('wp-1', { motivo: 'prueba' }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('sin tests ni informes -> no hay nada que reiniciar', async () => {
    wp.testResponses = [];
    informes = [];
    await expect(
      servicio.reiniciarParticipacion('wp-1', { motivo: 'prueba' }, admin),
    ).rejects.toThrow('no hay nada que reiniciar');
  });

  it('con enviarCorreo avisa a la persona con el mensaje del admin', async () => {
    const enviar = jest.spyOn(EmailHelper, 'sendEmail').mockResolvedValue(undefined as any);

    const r = await servicio.reiniciarParticipacion(
      'wp-1',
      { motivo: 'prueba', enviarCorreo: true, mensaje: 'Hola <b>Ana</b>' },
      admin,
    );

    expect(r.correoEnviado).toBe(true);
    const [para, asunto, , html] = enviar.mock.calls[0];
    expect(para).toBe('ana@example.com');
    expect(asunto).toContain('Operador de planta');
    expect(html).toContain('Hola &lt;b&gt;Ana&lt;/b&gt;');
  });

  it('si el correo falla, el reinicio queda hecho y lo informa', async () => {
    jest.spyOn(EmailHelper, 'sendEmail').mockRejectedValue(new Error('SMTP'));

    const r = await servicio.reiniciarParticipacion('wp-1', { motivo: 'prueba', enviarCorreo: true }, admin);

    expect(r.correoEnviado).toBe(false);
    expect(r.correoError).toContain('no se pudo enviar');
    expect(borradoTests).toEqual(['tr-1', 'tr-2']);
  });
});

describe('POST /test-responses/worker-process/:id/reiniciar: solo el admin', () => {
  const guard = new RolesGuard(new Reflector());
  const contexto = (role: UserRole) =>
    ({
      getHandler: () => TestResponsesController.prototype.reiniciarParticipacion,
      getClass: () => TestResponsesController,
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u', role } }) }),
    }) as unknown as ExecutionContext;

  it('el admin de Talentree puede', () => {
    expect(guard.canActivate(contexto(UserRole.ADMIN_TALENTREE))).toBe(true);
  });

  it.each([UserRole.WORKER, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST])(
    '%s no puede',
    (rol) => {
      expect(guard.canActivate(contexto(rol))).toBe(false);
    },
  );
});
