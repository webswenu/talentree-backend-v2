import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FixedTest } from '../entities/fixed-test.entity';
import { FixedTestQuestion } from '../entities/fixed-test-question.entity';
import { TestResponse } from '../../test-responses/entities/test-response.entity';
import { TestAnswer } from '../../test-responses/entities/test-answer.entity';
import { IcController } from './ic.controller';
import { IcService } from './ic.service';
import { IcScoringService } from './ic-scoring.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FixedTest,
      FixedTestQuestion,
      TestResponse,
      TestAnswer,
    ]),
  ],
  controllers: [IcController],
  providers: [IcService, IcScoringService],
  exports: [IcService],
})
export class IcModule {}
