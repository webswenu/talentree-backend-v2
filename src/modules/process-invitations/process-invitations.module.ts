import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessInvitationsController } from './process-invitations.controller';
import { ProcessInvitationsService } from './process-invitations.service';
import { ProcessInvitation } from './entities/process-invitation.entity';
import { SelectionProcess } from '../processes/entities/selection-process.entity';
import { User } from '../users/entities/user.entity';
import { Worker } from '../workers/entities/worker.entity';
import { WorkerProcess } from '../workers/entities/worker-process.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProcessInvitation,
      SelectionProcess,
      User,
      Worker,
      WorkerProcess,
    ]),
    AuditModule,
  ],
  controllers: [ProcessInvitationsController],
  providers: [ProcessInvitationsService],
  exports: [ProcessInvitationsService],
})
export class ProcessInvitationsModule {}
