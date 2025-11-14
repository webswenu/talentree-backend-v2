import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FixedTest } from '../entities/fixed-test.entity';
import { FixedTestQuestion } from '../entities/fixed-test-question.entity';
import { TestResponse } from '../../test-responses/entities/test-response.entity';
import { TestAnswer } from '../../test-responses/entities/test-answer.entity';
import { DiscController } from './disc.controller';
import { DiscService } from './disc.service';
import { DiscScoringService } from './disc-scoring.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FixedTest,
      FixedTestQuestion,
      TestResponse,
      TestAnswer,
    ]),
  ],
  controllers: [DiscController],
  providers: [DiscService, DiscScoringService],
  exports: [DiscService],
})
export class DiscModule {}
