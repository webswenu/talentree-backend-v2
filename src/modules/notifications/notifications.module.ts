import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsSchedulerService } from './notifications-scheduler.service';
import { Notification } from './entities/notification.entity';
import { SelectionProcess } from '../processes/entities/selection-process.entity';
import { WorkerProcess } from '../workers/entities/worker-process.entity';
import { TestResponse } from '../test-responses/entities/test-response.entity';
import { Report } from '../reports/entities/report.entity';
import { UsersModule } from '../users/users.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      SelectionProcess,
      WorkerProcess,
      TestResponse,
      Report,
    ]),
    ScheduleModule.forRoot(),
    /**
     * El gateway de sockets necesita verificar el token del handshake por su
     * cuenta: los guards de Nest no corren sobre una conexion WebSocket. Se
     * registra con el MISMO secreto que usa la API para que un token valido
     * aqui lo sea alla y al reves.
     */
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
    }),
    UsersModule,
    forwardRef(() => ReportsModule),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationsSchedulerService,
  ],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
