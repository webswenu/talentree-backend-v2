import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

/**
 * Canal de notificaciones en vivo.
 *
 * EL DEFECTO QUE ESTE ARCHIVO CIERRA: la identidad salia de
 * `client.handshake.query.userId`, o sea de un parametro de la URL escrito por
 * quien se conecta, y no se pedia ningun token. Sabiendo el UUID de una
 * persona, cualquiera —desde cualquier sitio web, porque el CORS estaba en
 * `origin: '*'`— podia:
 *
 *   - leer todas sus notificaciones (`getNotifications`),
 *   - marcarselas todas como leidas (`markAllAsRead`),
 *   - y en `markAsRead` ni siquiera hacia falta suplantar a nadie: marcaba
 *     CUALQUIER notificacion por su id, sin mirar de quien era.
 *
 * Ahora la identidad sale del token firmado y nunca del cliente. El parametro
 * `userId` del handshake se ignora por completo, aunque venga.
 */
@WebSocketGateway({
  cors: {
    /**
     * El origen se lee de la misma variable que usa la API HTTP. Estaba en '*',
     * que permite abrir el socket desde cualquier pagina del internet.
     */
    origin: (origen: string, callback: (err: Error | null, permitido?: boolean) => void) => {
      const permitidos = (process.env.CORS_ORIGIN || 'http://localhost:5173')
        .split(',')
        .map((o) => o.trim());

      // Sin origen: clientes que no son navegadores (apps moviles, pruebas).
      if (!origen || permitidos.includes(origen)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, string[]> = new Map();

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Saca el token del handshake.
   *
   * `auth` es el sitio que socket.io reserva para esto y es el que hay que
   * usar. Se acepta tambien `query` y la cabecera `Authorization` porque hay
   * clientes que lo mandan asi, pero el token se verifica igual en los tres
   * casos: lo que importa es que este FIRMADO, no por donde llego.
   */
  private extraerToken(client: Socket): string | null {
    const desdeAuth = (client.handshake.auth as any)?.token;
    const desdeQuery = client.handshake.query?.token;
    const desdeCabecera = client.handshake.headers?.authorization;

    const bruto =
      (typeof desdeAuth === 'string' && desdeAuth) ||
      (typeof desdeQuery === 'string' && desdeQuery) ||
      (typeof desdeCabecera === 'string' && desdeCabecera) ||
      null;

    if (!bruto) return null;

    return bruto.startsWith('Bearer ') ? bruto.slice(7) : bruto;
  }

  /** El id del usuario de ESTA conexion, ya verificado. Nunca el del query. */
  private idDeLaConexion(client: Socket): string | null {
    return (client.data?.userId as string) || null;
  }

  async handleConnection(client: Socket) {
    const token = this.extraerToken(client);

    if (!token) {
      this.logger.warn(`Socket ${client.id} sin token: se rechaza.`);
      client.emit('authError', {
        message: 'Tu sesión no llegó al canal de avisos. Vuelve a iniciar sesión.',
      });
      client.disconnect(true);
      return;
    }

    let userId: string;

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // `sub` es el claim estandar del token; aqui SI corresponde usarlo,
      // porque estamos leyendo el token crudo y no la entidad User.
      userId = payload?.sub;
    } catch (error) {
      this.logger.warn(
        `Socket ${client.id} con token invalido o vencido: se rechaza.`,
      );
      client.emit('authError', {
        message: 'Tu sesión expiró. Vuelve a iniciar sesión para recibir avisos.',
      });
      client.disconnect(true);
      return;
    }

    if (!userId) {
      client.disconnect(true);
      return;
    }

    client.data.userId = userId;

    const sockets = this.userSockets.get(userId) || [];
    sockets.push(client.id);
    this.userSockets.set(userId, sockets);
  }

  handleDisconnect(client: Socket) {
    const userId = this.idDeLaConexion(client);
    if (!userId) return;

    const sockets = this.userSockets.get(userId) || [];
    const filtered = sockets.filter((id) => id !== client.id);

    if (filtered.length > 0) {
      this.userSockets.set(userId, filtered);
    } else {
      this.userSockets.delete(userId);
    }
  }

  @SubscribeMessage('getNotifications')
  async handleGetNotifications(client: Socket) {
    const userId = this.idDeLaConexion(client);
    if (!userId) return;

    const notifications = await this.notificationsService.findByUser(userId);
    client.emit('notifications', notifications);
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(client: Socket, notificationId: string) {
    const userId = this.idDeLaConexion(client);
    if (!userId || typeof notificationId !== 'string') return;

    /**
     * Antes esto marcaba cualquier notificacion por su id, sin mirar de quien
     * era ni quien lo pedia. Ahora el servicio solo la marca si es de esta
     * persona, y si no lo es no se avisa cual era el motivo: no hay por que
     * confirmarle a nadie que ese id existe.
     */
    const marcada = await this.notificationsService.markAsReadForUser(
      notificationId,
      userId,
    );

    if (!marcada) {
      this.logger.warn(
        `El usuario ${userId} intento marcar como leida la notificacion ${notificationId}, que no es suya.`,
      );
    }

    const count = await this.notificationsService.getUnreadCount(userId);
    client.emit('unreadCount', count);
  }

  @SubscribeMessage('markAllAsRead')
  async handleMarkAllAsRead(client: Socket) {
    const userId = this.idDeLaConexion(client);
    if (!userId) return;

    await this.notificationsService.markAllAsRead(userId);
    client.emit('unreadCount', 0);
  }

  async sendNotificationToUser(
    userId: string,
    createNotificationDto: CreateNotificationDto,
  ) {
    const notification = await this.notificationsService.create(
      createNotificationDto,
    );

    const sockets = this.userSockets.get(userId);
    if (sockets && sockets.length > 0) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit('newNotification', notification);
      });
    }

    return notification;
  }

  async broadcastNotification(
    userIds: string[],
    createNotificationDto: Omit<CreateNotificationDto, 'userId'>,
  ) {
    for (const userId of userIds) {
      await this.sendNotificationToUser(userId, {
        ...createNotificationDto,
        userId,
      });
    }
  }
}
