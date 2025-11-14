import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FixedTest } from '../entities/fixed-test.entity';
import { FixedTestQuestion } from '../entities/fixed-test-question.entity';
import { TestResponse } from '../../test-responses/entities/test-response.entity';
import { TestAnswer } from '../../test-responses/entities/test-answer.entity';
import { WonderlicController } from './wonderlic.controller';
import { WonderlicService } from './wonderlic.service';
import { WonderlicScoringService } from './wonderlic-scoring.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FixedTest,
      FixedTestQuestion,
      TestResponse,
      TestAnswer,
    ]),
  ],
  controllers: [WonderlicController],
  providers: [WonderlicService, WonderlicScoringService],
  exports: [WonderlicService],
})
export class WonderlicModule {}
