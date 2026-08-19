import { NotificationsGateway } from './notifications.gateway';

const YO = '11111111-1111-4111-8111-111111111111';
const OTRA_PERSONA = '22222222-2222-4222-8222-222222222222';

/** Un socket de mentira con lo justo que el gateway toca. */
const armarSocket = (handshake: any = {}) => {
  const client: any = {
    id: 'socket-1',
    data: {},
    handshake: { auth: {}, query: {}, headers: {}, ...handshake },
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
  return client;
};

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let notificaciones: any;
  let jwt: any;

  beforeEach(() => {
    notificaciones = {
      findByUser: jest.fn().mockResolvedValue([{ id: 'n1' }]),
      markAsReadForUser: jest.fn().mockResolvedValue({ id: 'n1' }),
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
      getUnreadCount: jest.fn().mockResolvedValue(3),
      create: jest.fn(),
    };
    jwt = { verifyAsync: jest.fn() };
    const config = { get: jest.fn().mockReturnValue('secreto-de-prueba') };

    gateway = new NotificationsGateway(notificaciones, jwt, config as any);
    jest.spyOn(gateway['logger'], 'warn').mockImplementation(() => undefined);
  });

  describe('handshake', () => {
    it('cierra la conexión que no trae token', async () => {
      const client = armarSocket();

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.data.userId).toBeUndefined();
    });

    it('cierra la conexión con token inválido o vencido', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
      const client = armarSocket({ auth: { token: 'token-cualquiera' } });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.emit).toHaveBeenCalledWith(
        'authError',
        expect.objectContaining({ message: expect.stringContaining('sesión') }),
      );
    });

    it('acepta el token firmado y guarda la identidad del token', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: YO });
      const client = armarSocket({ auth: { token: 'token-valido' } });

      await gateway.handleConnection(client);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.data.userId).toBe(YO);
    });

    /**
     * El defecto original: la identidad salía de `handshake.query.userId`.
     * Ahora ese parámetro se ignora aunque venga, y aunque diga otra cosa.
     */
    it('ignora el userId del query y se queda con el del token', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: YO });
      const client = armarSocket({
        auth: { token: 'token-valido' },
        query: { userId: OTRA_PERSONA },
      });

      await gateway.handleConnection(client);

      expect(client.data.userId).toBe(YO);
      expect(client.data.userId).not.toBe(OTRA_PERSONA);
    });

    it('no deja entrar solo con el userId en el query, sin token', async () => {
      const client = armarSocket({ query: { userId: OTRA_PERSONA } });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('lectura de avisos', () => {
    it('entrega los del dueño de la conexión, no los del query', async () => {
      const client = armarSocket({ query: { userId: OTRA_PERSONA } });
      client.data.userId = YO;

      await gateway.handleGetNotifications(client);

      expect(notificaciones.findByUser).toHaveBeenCalledWith(YO);
      expect(notificaciones.findByUser).not.toHaveBeenCalledWith(OTRA_PERSONA);
    });

    it('no entrega nada si la conexión no está identificada', async () => {
      const client = armarSocket();

      await gateway.handleGetNotifications(client);

      expect(notificaciones.findByUser).not.toHaveBeenCalled();
    });
  });

  describe('marcar como leída', () => {
    /**
     * Este era el peor de los tres: marcaba cualquier notificación por su id,
     * sin mirar de quién era ni quién lo pedía.
     */
    it('solo marca si la notificación es de quien lo pide', async () => {
      const client = armarSocket();
      client.data.userId = YO;

      await gateway.handleMarkAsRead(client, 'notificacion-ajena');

      expect(notificaciones.markAsReadForUser).toHaveBeenCalledWith(
        'notificacion-ajena',
        YO,
      );
    });

    it('no revela nada cuando la notificación no es suya', async () => {
      notificaciones.markAsReadForUser.mockResolvedValue(null);
      const client = armarSocket();
      client.data.userId = YO;

      await gateway.handleMarkAsRead(client, 'notificacion-ajena');

      const emitidos = client.emit.mock.calls.map((c: any[]) => c[0]);
      expect(emitidos).not.toContain('error');
      expect(emitidos).toContain('unreadCount');
    });

    it('no hace nada si la conexión no está identificada', async () => {
      const client = armarSocket();

      await gateway.handleMarkAsRead(client, 'n1');

      expect(notificaciones.markAsReadForUser).not.toHaveBeenCalled();
    });

    it('ignora un id que no sea texto', async () => {
      const client = armarSocket();
      client.data.userId = YO;

      await gateway.handleMarkAsRead(client, { $ne: null } as any);

      expect(notificaciones.markAsReadForUser).not.toHaveBeenCalled();
    });
  });

  describe('marcar todas como leídas', () => {
    it('usa la identidad del token', async () => {
      const client = armarSocket({ query: { userId: OTRA_PERSONA } });
      client.data.userId = YO;

      await gateway.handleMarkAllAsRead(client);

      expect(notificaciones.markAllAsRead).toHaveBeenCalledWith(YO);
    });

    it('no hace nada sin identidad', async () => {
      await gateway.handleMarkAllAsRead(armarSocket());

      expect(notificaciones.markAllAsRead).not.toHaveBeenCalled();
    });
  });
});
