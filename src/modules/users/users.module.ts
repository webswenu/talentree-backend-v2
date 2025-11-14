import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { Worker } from '../workers/entities/worker.entity';
import { SelectionProcess } from '../processes/entities/selection-process.entity';
import { Report } from '../reports/entities/report.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Company } from '../companies/entities/company.entity';
import { Invitation } from '../invitations/entities/invitation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Worker,
      SelectionProcess,
      Report,
      AuditLog,
      Notification,
      Company,
      Invitation,
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
