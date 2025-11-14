import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FixedTest } from '../entities/fixed-test.entity';
import { FixedTestQuestion } from '../entities/fixed-test-question.entity';
import { TestResponse } from '../../test-responses/entities/test-response.entity';
import { TestAnswer } from '../../test-responses/entities/test-answer.entity';
import { CfrController } from './cfr.controller';
import { CfrService } from './cfr.service';
import { CfrScoringService } from './cfr-scoring.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FixedTest,
      FixedTestQuestion,
      TestResponse,
      TestAnswer,
    ]),
  ],
  controllers: [CfrController],
  providers: [CfrService, CfrScoringService],
  exports: [CfrService],
})
export class CfrModule {}
