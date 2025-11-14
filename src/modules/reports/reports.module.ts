import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Report } from './entities/report.entity';
import { DocumentGeneratorService } from './document-generator.service';
import { UsersModule } from '../users/users.module';
import { WorkerProcess } from '../workers/entities/worker-process.entity';
import { TestResponse } from '../test-responses/entities/test-response.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, WorkerProcess, TestResponse]),
    UsersModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, DocumentGeneratorService],
  exports: [ReportsService],
})
export class ReportsModule {}
