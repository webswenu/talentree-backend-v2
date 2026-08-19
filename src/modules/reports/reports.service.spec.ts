import { ReportsService } from './reports.service';
import { ReportStatus } from '../../common/enums/report-status.enum';
import { NotificationType } from '../../common/enums/notification-type.enum';

const EMPRESA = 'aaaaaaaa-0000-4000-8000-000000000001';
const ADMIN = { id: 'admin-1', email: 'talentree@admin.com' };

/**
 * Lo que fijan estas pruebas (verificado en producción el 19-08-2026):
 *
 * El aviso a la empresa salía al SUBIR el PDF, cuando el informe queda en
 * revisión. Pero la empresa solo puede ver los informes APROBADOS, así que
 * recibía «El reporte de X está disponible», hacía clic y encontraba la
 * pantalla vacía. Y en el momento en que el informe sí pasaba a ser visible
 * —la aprobación— no se enteraba nadie.
 */
describe('ReportsService · aviso a la empresa al aprobar', () => {
  let servicio: ReportsService;
  let informes: any;
  let usuarios: any;
  let avisos: any;

  const informeDeLaEmpresa = {
    id: 'rep-1',
    status: ReportStatus.REVISION_ADMIN,
    worker: { firstName: 'Rodrigo', lastName: 'Fuentes QA' },
    process: { id: 'proc-1', company: { id: EMPRESA } },
  };

  beforeEach(() => {
    informes = {
      findOne: jest.fn().mockResolvedValue({ ...informeDeLaEmpresa }),
      save: jest.fn().mockImplementation(async (r) => r),
    };
    usuarios = {
      findOne: jest.fn().mockResolvedValue(ADMIN),
      findCompanyUsers: jest
        .fn()
        .mockResolvedValue([{ id: 'user-empresa-1' }, { id: 'user-empresa-2' }]),
    };
    avisos = { broadcastNotification: jest.fn().mockResolvedValue(undefined) };

    servicio = new ReportsService(
      informes,
      {} as any,
      usuarios,
      {} as any,
      {} as any,
      avisos,
    );
    jest.spyOn(servicio['logger'], 'error').mockImplementation(() => undefined);
  });

  it('avisa a la empresa cuando el informe queda aprobado', async () => {
    await servicio.approveReport(
      'rep-1',
      { status: ReportStatus.APPROVED } as any,
      ADMIN.id,
    );

    expect(avisos.broadcastNotification).toHaveBeenCalledTimes(1);
    const [ids, contenido] = avisos.broadcastNotification.mock.calls[0];
    expect(ids).toEqual(['user-empresa-1', 'user-empresa-2']);
    expect(contenido.type).toBe(NotificationType.REPORT_READY);
    expect(contenido.message).toContain('Rodrigo Fuentes QA');
    expect(contenido.link).toBe('/empresa/reportes');
  });

  it('NO avisa a la empresa cuando el informe se rechaza', async () => {
    await servicio.approveReport(
      'rep-1',
      { status: ReportStatus.REJECTED, rejectionReason: 'faltan datos' } as any,
      ADMIN.id,
    );

    expect(avisos.broadcastNotification).not.toHaveBeenCalled();
  });

  it('registra quién aprobó y cuándo', async () => {
    const guardado = await servicio.approveReport(
      'rep-1',
      { status: ReportStatus.APPROVED } as any,
      ADMIN.id,
    );

    expect(guardado.approvedBy).toEqual(ADMIN);
    expect(guardado.approvedAt).toBeInstanceOf(Date);
  });

  it('si el aviso falla, la aprobación se mantiene', async () => {
    avisos.broadcastNotification.mockRejectedValue(new Error('socket caído'));

    const guardado = await servicio.approveReport(
      'rep-1',
      { status: ReportStatus.APPROVED } as any,
      ADMIN.id,
    );

    expect(guardado.status).toBe(ReportStatus.APPROVED);
    expect(informes.save).toHaveBeenCalled();
  });

  it('no intenta avisar si el proceso no tiene empresa resuelta', async () => {
    informes.findOne.mockResolvedValue({
      ...informeDeLaEmpresa,
      process: { id: 'proc-1', company: null },
    });

    await servicio.approveReport(
      'rep-1',
      { status: ReportStatus.APPROVED } as any,
      ADMIN.id,
    );

    expect(avisos.broadcastNotification).not.toHaveBeenCalled();
  });

  it('no manda un aviso vacío si la empresa no tiene usuarios activos', async () => {
    usuarios.findCompanyUsers.mockResolvedValue([]);

    await servicio.approveReport(
      'rep-1',
      { status: ReportStatus.APPROVED } as any,
      ADMIN.id,
    );

    expect(avisos.broadcastNotification).not.toHaveBeenCalled();
  });
});
