import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SelectionProcess } from './entities/selection-process.entity';
import { ProcessVideoRequirement } from './entities/process-video-requirement.entity';
import { ProcessesService } from './processes.service';
import { ProcessVideoRequirementsService } from './process-video-requirements.service';
import { ProcessesController } from './processes.controller';
import { CompaniesModule } from '../companies/companies.module';
import { UsersModule } from '../users/users.module';
import { Test } from '../tests/entities/test.entity';
import { FixedTest } from '../tests/entities/fixed-test.entity';
import { WorkerProcess } from '../workers/entities/worker-process.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SelectionProcess,
      ProcessVideoRequirement,
      Test,
      FixedTest,
      WorkerProcess,
    ]),
    CompaniesModule,
    UsersModule,
    NotificationsModule,
  ],
  controllers: [ProcessesController],
  providers: [ProcessesService, ProcessVideoRequirementsService],
  exports: [ProcessesService, ProcessVideoRequirementsService],
})
export class ProcessesModule {}
