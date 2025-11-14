import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, string[]> = new Map();

  constructor(private readonly notificationsService: NotificationsService) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      const sockets = this.userSockets.get(userId) || [];
      sockets.push(client.id);
      this.userSockets.set(userId, sockets);
      console.log(`User ${userId} connected with socket ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      const sockets = this.userSockets.get(userId) || [];
      const filtered = sockets.filter((id) => id !== client.id);
      if (filtered.length > 0) {
        this.userSockets.set(userId, filtered);
      } else {
        this.userSockets.delete(userId);
      }
      console.log(`User ${userId} disconnected from socket ${client.id}`);
    }
  }

  @SubscribeMessage('getNotifications')
  async handleGetNotifications(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      const notifications = await this.notificationsService.findByUser(userId);
      client.emit('notifications', notifications);
    }
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(client: Socket, notificationId: string) {
    await this.notificationsService.markAsRead(notificationId);
    const userId = client.handshake.query.userId as string;
    if (userId) {
      const count = await this.notificationsService.getUnreadCount(userId);
      client.emit('unreadCount', count);
    }
  }

  @SubscribeMessage('markAllAsRead')
  async handleMarkAllAsRead(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      await this.notificationsService.markAllAsRead(userId);
      client.emit('unreadCount', 0);
    }
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
