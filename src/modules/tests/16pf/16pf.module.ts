import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FixedTest } from '../entities/fixed-test.entity';
import { FixedTestQuestion } from '../entities/fixed-test-question.entity';
import { TestResponse } from '../../test-responses/entities/test-response.entity';
import { TestAnswer } from '../../test-responses/entities/test-answer.entity';
import { SixteenPfController } from './16pf.controller';
import { SixteenPfService } from './16pf.service';
import { SixteenPfScoringService } from './16pf-scoring.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FixedTest,
      FixedTestQuestion,
      TestResponse,
      TestAnswer,
    ]),
  ],
  controllers: [SixteenPfController],
  providers: [SixteenPfService, SixteenPfScoringService],
  exports: [SixteenPfService],
})
export class SixteenPfModule {}
