import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProcessInvitationsService } from './process-invitations.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { ProcessInvitationStatus } from './entities/process-invitation.entity';

const EMPRESA_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const EMPRESA_B = 'bbbbbbbb-0000-4000-8000-000000000002';

const empresaA = { role: UserRole.COMPANY, company: { id: EMPRESA_A } };
const empresaB = { role: UserRole.COMPANY, company: { id: EMPRESA_B } };
const talentree = { role: UserRole.ADMIN_TALENTREE, id: 'admin-1' };

/**
 * Lo que fijan estas pruebas, verificado en producción el 19-08-2026 con una
 * sesión real: una empresa recién creada, con CERO invitaciones propias,
 * recibía 15 invitaciones de otras cinco empresas al pedir el listado sin
 * filtros — con el nombre y el correo de los candidatos de la competencia.
 */
describe('ProcessInvitationsService · aislamiento entre empresas', () => {
  let servicio: ProcessInvitationsService;
  let repo: any;
  let qb: any;

  const invitacionDeA = {
    id: 'inv-1',
    status: ProcessInvitationStatus.PENDING,
    process: { id: 'proc-1', company: { id: EMPRESA_A } },
  };

  beforeEach(() => {
    qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      // lo que usa el helper de paginación
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (x) => x),
    };
    servicio = new ProcessInvitationsService(repo, {} as any, {} as any, {} as any, {} as any);
  });

  /** Devuelve las condiciones que se le agregaron a la consulta. */
  const condiciones = () => qb.andWhere.mock.calls.map((c: any[]) => c[0]).join(' | ');

  describe('listado', () => {
    it('recorta por la empresa de la sesión', async () => {
      await servicio.findAll({} as any, empresaB);

      expect(condiciones()).toContain('company.id = :empresaDeLaSesion');
      const params = qb.andWhere.mock.calls[0][1];
      expect(params.empresaDeLaSesion).toBe(EMPRESA_B);
    });

    it('con empresa sin resolver no devuelve nada, en vez de devolver todo', async () => {
      await servicio.findAll({} as any, { role: UserRole.COMPANY });

      const params = qb.andWhere.mock.calls[0][1];
      expect(params.empresaDeLaSesion).toBe('00000000-0000-0000-0000-000000000000');
    });

    it('Talentree no queda recortada', async () => {
      await servicio.findAll({} as any, talentree);

      expect(condiciones()).not.toContain('company.id = :empresaDeLaSesion');
    });

    it('el processId del querystring no reemplaza al recorte de la sesión', async () => {
      // Aunque pida el proceso de OTRA empresa, el recorte sigue aplicándose.
      await servicio.findAll({ processId: 'proceso-de-la-empresa-A' } as any, empresaB);

      expect(condiciones()).toContain('company.id = :empresaDeLaSesion');
      expect(condiciones()).toContain('process.id = :processId');
    });
  });

  describe('detalle y acciones sobre una invitación ajena', () => {
    beforeEach(() => {
      repo.findOne.mockResolvedValue({ ...invitacionDeA });
    });

    it('corta al leer el detalle', async () => {
      await expect(servicio.findOne('inv-1', empresaB)).rejects.toThrow(ForbiddenException);
    });

    it('corta al cancelar, y no guarda nada', async () => {
      await expect(servicio.cancel('inv-1', empresaB)).rejects.toThrow(ForbiddenException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('corta al reenviar, y no genera un token nuevo', async () => {
      await expect(servicio.resend('inv-1', empresaB)).rejects.toThrow(ForbiddenException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('la empresa dueña sí puede leer el detalle', async () => {
      await expect(servicio.findOne('inv-1', empresaA)).resolves.toBeDefined();
    });

    it('dice «no encontrada» y no «es de otra empresa» cuando no existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(servicio.findOne('no-existe', empresaA)).rejects.toThrow(NotFoundException);
    });
  });
});
