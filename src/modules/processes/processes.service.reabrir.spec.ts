import { ProcessesService } from './processes.service';
import { ProcessStatus } from '../../common/enums/process-status.enum';

/**
 * Extender la fecha de término de un proceso que el cierre automático dio por
 * completado lo vuelve a abrir (caso «Asistente Administrativo», 20-11-2026).
 */
describe('ProcessesService.update: reabrir al extender la fecha', () => {
  const guardados: any[] = [];
  let proceso: any;
  let servicio: ProcessesService;
  const notificar = jest.fn();

  const crear = (status: ProcessStatus, endDate: string | null) => {
    proceso = {
      id: 'p1',
      name: 'Asistente Administrativo',
      status,
      startDate: '2026-11-01',
      endDate,
      company: { id: 'c1' },
    };
  };

  beforeEach(() => {
    // 20-11-2026, 17:00 en Chile.
    jest.useFakeTimers().setSystemTime(new Date('2026-11-20T20:00:00Z'));
    guardados.length = 0;
    notificar.mockReset();
    const repo: any = {
      findOne: jest.fn(async () => proceso),
      save: jest.fn(async (p: any) => {
        guardados.push({ ...p });
        return p;
      }),
    };
    const usuarios: any = {
      findCompanyUsers: jest.fn(async () => [{ id: 'u1' }]),
      findByRole: jest.fn(async () => []),
    };
    servicio = new ProcessesService(
      repo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      usuarios,
      { broadcastNotification: notificar } as any,
    );
    jest.spyOn(servicio['logger'], 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.useRealTimers());

  const estadoGuardado = () => guardados[guardados.length - 1].status;

  it('completado + fecha extendida (el formulario reenvía «completado») -> activo', async () => {
    crear(ProcessStatus.COMPLETED, '2026-11-20');
    await servicio.update('p1', { endDate: '2026-11-25', status: ProcessStatus.COMPLETED } as any);
    expect(estadoGuardado()).toBe(ProcessStatus.ACTIVE);
  });

  it('completado + fecha extendida sin mandar estado -> activo', async () => {
    crear(ProcessStatus.COMPLETED, '2026-11-20');
    await servicio.update('p1', { endDate: '2026-11-25' } as any);
    expect(estadoGuardado()).toBe(ProcessStatus.ACTIVE);
  });

  it('extender hasta hoy también reabre: el último día está abierto', async () => {
    crear(ProcessStatus.COMPLETED, '2026-11-19');
    await servicio.update('p1', { endDate: '2026-11-20' } as any);
    expect(estadoGuardado()).toBe(ProcessStatus.ACTIVE);
  });

  it('una fecha nueva que ya pasó no reabre', async () => {
    crear(ProcessStatus.COMPLETED, '2026-11-10');
    await servicio.update('p1', { endDate: '2026-11-15' } as any);
    expect(estadoGuardado()).toBe(ProcessStatus.COMPLETED);
  });

  it('editar otra cosa sin cambiar la fecha no reabre', async () => {
    crear(ProcessStatus.COMPLETED, '2026-11-25');
    await servicio.update('p1', { endDate: '2026-11-25', description: 'x' } as any);
    expect(estadoGuardado()).toBe(ProcessStatus.COMPLETED);
  });

  it('si en la misma edición se eligió otro estado, se respeta', async () => {
    crear(ProcessStatus.COMPLETED, '2026-11-20');
    await servicio.update('p1', { endDate: '2026-11-25', status: ProcessStatus.CLOSED } as any);
    expect(estadoGuardado()).toBe(ProcessStatus.CLOSED);
  });

  it('solo reabre procesos completados: uno cerrado o pausado se queda como está', async () => {
    crear(ProcessStatus.CLOSED, '2026-11-20');
    await servicio.update('p1', { endDate: '2026-11-25', status: ProcessStatus.CLOSED } as any);
    expect(estadoGuardado()).toBe(ProcessStatus.CLOSED);

    crear(ProcessStatus.PAUSED, '2026-11-20');
    await servicio.update('p1', { endDate: '2026-11-25' } as any);
    expect(estadoGuardado()).toBe(ProcessStatus.PAUSED);
  });

  it('reabrir no avisa a todos los trabajadores como una oferta nueva', async () => {
    crear(ProcessStatus.COMPLETED, '2026-11-20');
    await servicio.update('p1', { endDate: '2026-11-25', status: ProcessStatus.COMPLETED } as any);
    expect(notificar).not.toHaveBeenCalled();
  });
});
