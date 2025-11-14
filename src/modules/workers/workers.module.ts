import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkersService } from './workers.service';
import { WorkersController } from './workers.controller';
import { Worker } from './entities/worker.entity';
import { WorkerProcess } from './entities/worker-process.entity';
import { SelectionProcess } from '../processes/entities/selection-process.entity';
import { Report } from '../reports/entities/report.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Worker, WorkerProcess, SelectionProcess, Report, User]),
  ],
  controllers: [WorkersController],
  providers: [WorkersService],
  exports: [WorkersService],
})
export class WorkersModule {}
