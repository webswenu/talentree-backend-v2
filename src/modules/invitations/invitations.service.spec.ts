import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { InvitationStatus } from './entities/invitation.entity';

const EMPRESA_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const EMPRESA_B = 'bbbbbbbb-0000-4000-8000-000000000002';

const empresaA = { role: UserRole.COMPANY, company: { id: EMPRESA_A } };
const empresaB = { role: UserRole.COMPANY, company: { id: EMPRESA_B } };
const talentree = { role: UserRole.ADMIN_TALENTREE, id: 'admin-1' };

/**
 * El defecto que fijan estas pruebas: los cinco métodos tomaban el id de la
 * URL y ni siquiera recibían quién preguntaba. Con rol COMPANY bastaba cambiar
 * el id en la barra de direcciones para leer, reenviar o cancelar las
 * invitaciones de otra empresa, y para desactivar a sus invitados.
 */
describe('InvitationsService · aislamiento entre empresas', () => {
  let servicio: InvitationsService;
  let invitaciones: any;
  let usuarios: any;

  beforeEach(() => {
    invitaciones = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn(), save: jest.fn() };
    usuarios = { findOne: jest.fn(), save: jest.fn() };
    servicio = new InvitationsService(invitaciones, usuarios);
  });

  describe('findAll', () => {
    it('deja a la empresa ver sus propias invitaciones', async () => {
      await expect(servicio.findAll(EMPRESA_A, empresaA)).resolves.toBeDefined();
      expect(invitaciones.find).toHaveBeenCalled();
    });

    it('corta a la empresa que pide las de otra', async () => {
      await expect(servicio.findAll(EMPRESA_B, empresaA)).rejects.toThrow(
        ForbiddenException,
      );
      expect(invitaciones.find).not.toHaveBeenCalled();
    });

    it('Talentree puede ver las de cualquiera', async () => {
      await expect(servicio.findAll(EMPRESA_B, talentree)).resolves.toBeDefined();
    });
  });

  describe('resendInvitation', () => {
    const invitacionDeA = {
      id: 'inv-1',
      companyId: EMPRESA_A,
      status: InvitationStatus.PENDING,
    };

    it('corta a la empresa que reenvía una invitación ajena', async () => {
      invitaciones.findOne.mockResolvedValue(invitacionDeA);

      await expect(servicio.resendInvitation('inv-1', empresaB)).rejects.toThrow(
        ForbiddenException,
      );
      expect(invitaciones.save).not.toHaveBeenCalled();
    });

    it('dice «no encontrada» y no «es de otra empresa» cuando no existe', async () => {
      invitaciones.findOne.mockResolvedValue(null);

      await expect(servicio.resendInvitation('no-existe', empresaA)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancelInvitation', () => {
    it('corta a la empresa que cancela una invitación ajena', async () => {
      invitaciones.findOne.mockResolvedValue({
        id: 'inv-1',
        companyId: EMPRESA_A,
        status: InvitationStatus.PENDING,
      });

      await expect(servicio.cancelInvitation('inv-1', empresaB)).rejects.toThrow(
        ForbiddenException,
      );
      expect(invitaciones.save).not.toHaveBeenCalled();
    });
  });

  describe('deactivateUser / reactivateUser', () => {
    const invitadoDeA = { id: 'u-1', role: UserRole.GUEST, companyId: EMPRESA_A };

    it('corta a la empresa que desactiva al invitado de otra', async () => {
      usuarios.findOne.mockResolvedValue({ ...invitadoDeA });

      await expect(servicio.deactivateUser('u-1', empresaB)).rejects.toThrow(
        ForbiddenException,
      );
      expect(usuarios.save).not.toHaveBeenCalled();
    });

    it('deja a la empresa desactivar a su propio invitado', async () => {
      usuarios.findOne.mockResolvedValue({ ...invitadoDeA });

      await servicio.deactivateUser('u-1', empresaA);

      expect(usuarios.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('corta también al reactivar', async () => {
      usuarios.findOne.mockResolvedValue({ ...invitadoDeA });

      await expect(servicio.reactivateUser('u-1', empresaB)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('sigue rechazando desactivar a alguien que no es invitado', async () => {
      usuarios.findOne.mockResolvedValue({
        id: 'u-2',
        role: UserRole.WORKER,
        companyId: EMPRESA_A,
      });

      await expect(servicio.deactivateUser('u-2', empresaA)).rejects.toThrow(
        /invitados/,
      );
    });
  });
});
