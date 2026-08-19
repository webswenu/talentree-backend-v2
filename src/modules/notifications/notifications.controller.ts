import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ForbiddenException,
  Request,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

/**
 * ORDEN DE LAS RUTAS (hallazgos P-34 y P-74).
 *
 * En NestJS manda el orden de declaracion, no lo especifica que sea la ruta.
 * Antes 'mark-all-read' estaba declarada DESPUES de @Patch(':id'), asi que
 * nunca se alcanzaba: el literal entraba como si fuera un identificador y la
 * peticion moria con un 400 de base de datos al intentar usar 'mark-all-read'
 * como UUID. La regla, para todo el proyecto: primero los literales, despues
 * los parametrizados.
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // Crear notificaciones a mano es una operacion administrativa: hasta ahora
  // cualquier usuario autenticado podia inyectarle una notificacion a otro.
  @Post()
  @Roles(UserRole.ADMIN_TALENTREE)
  create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationsService.create(createNotificationDto);
  }

  // ---- rutas literales (van primero) ----

  @Get('my-notifications')
  getMyNotifications(@Request() req) {
    return this.notificationsService.findByUser(req.user.id);
  }

  @Get('unread')
  getUnread(@Request() req) {
    return this.notificationsService.findUnreadByUser(req.user.id);
  }

  @Get('unread-count')
  getUnreadCount(@Request() req) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Patch('mark-all-read')
  markAllAsRead(@Request() req) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  // ---- rutas parametrizadas (van despues) ----

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    return this.assertOwn(id, req);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
    @Request() req,
  ) {
    await this.assertOwn(id, req);
    return this.notificationsService.update(id, updateNotificationDto);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req) {
    await this.assertOwn(id, req);
    return this.notificationsService.markAsRead(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    await this.assertOwn(id, req);
    return this.notificationsService.remove(id);
  }

  /**
   * Una notificacion es de una sola persona. Sin esta comprobacion, cualquier
   * usuario autenticado podia leer, marcar como leida o borrar las
   * notificaciones de cualquier otro con solo conocer el id.
   */
  private async assertOwn(id: string, req: any) {
    const notification: any = await this.notificationsService.findOne(id);
    const dueno = notification?.user?.id ?? notification?.userId;

    if (req.user?.role !== UserRole.ADMIN_TALENTREE && dueno !== req.user?.id) {
      throw new ForbiddenException(
        'Esta notificación no es tuya.',
      );
    }

    return notification;
  }
}
