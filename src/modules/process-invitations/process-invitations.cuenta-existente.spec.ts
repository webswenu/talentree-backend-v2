import { ConflictException } from '@nestjs/common';
import { ProcessInvitationsService } from './process-invitations.service';
import { ProcessInvitationStatus } from './entities/process-invitation.entity';

/**
 * Casos de producción del 21 y 24-11-2026: candidatos que ya tenían cuenta o
 * que ya postulaban al proceso recibían una invitación y quedaban atascados.
 */
describe('ProcessInvitationsService · candidatos que ya tienen cuenta', () => {
  let invitaciones: any;
  let procesos: any;
  let usuarios: any;
  let trabajadores: any;
  let postulaciones: any;
  let servicio: ProcessInvitationsService;

  const proceso = { id: 'p-1', name: 'Maestro Primera', company: { name: 'Constructora' } };

  beforeEach(() => {
    invitaciones = {
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'inv-nueva', ...x })),
    };
    procesos = { findOne: jest.fn(async () => proceso) };
    usuarios = { count: jest.fn(async () => 0), findOne: jest.fn() };
    trabajadores = { findOne: jest.fn() };
    postulaciones = {
      count: jest.fn(async () => 0),
      findOne: jest.fn(async () => null),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    servicio = new ProcessInvitationsService(invitaciones, procesos, usuarios, trabajadores, postulaciones);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('GET by-token informa si el correo ya tiene cuenta', () => {
    const invitacion = {
      id: 'inv-1',
      email: 'Ana@Example.com',
      status: ProcessInvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 86_400_000),
      process: proceso,
    };

    it('con cuenta -> tieneCuenta = true (busca el correo sin mayúsculas)', async () => {
      invitaciones.findOne.mockResolvedValue({ ...invitacion });
      usuarios.count.mockResolvedValue(1);

      const r = await servicio.findByToken('tok');

      expect(r.tieneCuenta).toBe(true);
      const condicion = usuarios.count.mock.calls[0][0].where.email;
      expect(condicion.getSql('u.email')).toBe('LOWER(u.email) = :correo');
      expect(condicion.objectLiteralParameters).toEqual({ correo: 'ana@example.com' });
    });

    it('sin cuenta -> tieneCuenta = false', async () => {
      invitaciones.findOne.mockResolvedValue({ ...invitacion });

      const r = await servicio.findByToken('tok');

      expect(r.tieneCuenta).toBe(false);
    });
  });

  describe('crear invitación a alguien que ya postula al proceso', () => {
    it('se rechaza con un mensaje claro y no se guarda ni se envía nada', async () => {
      invitaciones.findOne.mockResolvedValue(null);
      postulaciones.count.mockResolvedValue(1);

      await expect(
        servicio.create({ processId: 'p-1', email: 'Ana@Example.com', firstName: 'Ana', lastName: 'Pérez' }, 'admin-1'),
      ).rejects.toThrow(new ConflictException('ana@example.com ya está postulando a "Maestro Primera". No hace falta invitarlo de nuevo.'));
      expect(invitaciones.save).not.toHaveBeenCalled();
    });

    it('en la carga masiva queda en «fallidas» con ese motivo y el resto sigue', async () => {
      invitaciones.findOne.mockResolvedValue(null);
      postulaciones.count.mockImplementation(async ({ where }: any) =>
        where.worker.email.objectLiteralParameters.correo === 'ya@postula.cl' ? 1 : 0,
      );
      jest.spyOn(servicio as any, 'sendInvitationEmail').mockResolvedValue(undefined);
      invitaciones.findOne
        .mockResolvedValueOnce(null) // pendiente de ya@postula.cl
        .mockResolvedValueOnce(null) // pendiente de nueva@persona.cl
        .mockResolvedValue({ id: 'inv-nueva', email: 'nueva@persona.cl', process: proceso });

      const r = await servicio.bulkCreate(
        {
          processId: 'p-1',
          invitees: [
            { email: 'ya@postula.cl', firstName: 'Ya', lastName: 'Postula' },
            { email: 'nueva@persona.cl', firstName: 'Nueva', lastName: 'Persona' },
          ],
        } as any,
        'admin-1',
      );

      expect(r.failed).toEqual([
        { fila: 2, email: 'ya@postula.cl', reason: expect.stringContaining('ya está postulando') },
      ]);
      expect(r.successful).toHaveLength(1);
    });

    it('si postula a OTRO proceso, se puede invitar sin problema', async () => {
      invitaciones.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValue({ id: 'inv-nueva', email: 'ana@example.com', process: proceso });
      jest.spyOn(servicio as any, 'sendInvitationEmail').mockResolvedValue(undefined);

      const r = await servicio.create(
        { processId: 'p-1', email: 'ana@example.com', firstName: 'Ana', lastName: 'Pérez' },
        'admin-1',
      );

      expect(r.id).toBe('inv-nueva');
      expect(postulaciones.count.mock.calls[0][0].where.process).toEqual({ id: 'p-1' });
    });
  });

  describe('aceptar por el enlace cuando ya postula al proceso', () => {
    it('no es un error: marca la invitación como aceptada y devuelve el proceso', async () => {
      const invitacion: any = {
        id: 'inv-1',
        email: 'ana@example.com',
        status: ProcessInvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 86_400_000),
        process: proceso,
      };
      invitaciones.findOne.mockResolvedValue(invitacion);
      usuarios.findOne.mockResolvedValue({ id: 'u-1', email: 'ana@example.com', worker: { id: 'w-1' } });
      trabajadores.findOne.mockResolvedValue({ id: 'w-1' });
      postulaciones.findOne.mockResolvedValue({ id: 'wp-1' });

      const r = await servicio.accept({ token: 'tok' }, 'u-1');

      expect(r.status).toBe('applied');
      expect(r.processId).toBe('p-1');
      expect(invitacion.status).toBe(ProcessInvitationStatus.ACCEPTED);
      expect(postulaciones.save).not.toHaveBeenCalled();
    });
  });
});
