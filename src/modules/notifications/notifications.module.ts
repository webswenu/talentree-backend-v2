import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsSchedulerService } from './notifications-scheduler.service';
import { Notification } from './entities/notification.entity';
import { SelectionProcess } from '../processes/entities/selection-process.entity';
import { WorkerProcess } from '../workers/entities/worker-process.entity';
import { TestResponse } from '../test-responses/entities/test-response.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      SelectionProcess,
      WorkerProcess,
      TestResponse,
    ]),
    ScheduleModule.forRoot(),
    UsersModule,
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
