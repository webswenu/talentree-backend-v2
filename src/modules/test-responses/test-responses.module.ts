import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestResponsesService } from './test-responses.service';
import { TestResponsesController } from './test-responses.controller';
import { TestResponse } from './entities/test-response.entity';
import { TestAnswer } from './entities/test-answer.entity';
import { WorkerProcess } from '../workers/entities/worker-process.entity';
import { SelectionProcess } from '../processes/entities/selection-process.entity';
import { ReportsModule } from '../reports/reports.module';
import { TestCFRScoringService } from './scoring/test-cfr-scoring.service';
import { Test16PFScoringService } from './scoring/test-16pf-scoring.service';
import { TestDISCScoringService } from './scoring/test-disc-scoring.service';
import { TestILScoringService } from './scoring/test-il-scoring.service';
import { TestICScoringService } from './scoring/test-ic-scoring.service';
import { TestTACScoringService } from './scoring/test-tac-scoring.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TestResponse, TestAnswer, WorkerProcess, SelectionProcess]),
    forwardRef(() => ReportsModule),
  ],
  controllers: [TestResponsesController],
  providers: [TestResponsesService, TestCFRScoringService, Test16PFScoringService, TestDISCScoringService, TestILScoringService, TestICScoringService, TestTACScoringService],
  exports: [TestResponsesService],
})
export class TestResponsesModule {}
