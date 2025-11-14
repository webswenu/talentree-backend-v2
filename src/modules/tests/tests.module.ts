import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestsService } from './tests.service';
import { TestsController } from './tests.controller';
import { Test } from './entities/test.entity';
import { TestQuestion } from './entities/test-question.entity';
import { FixedTest } from './entities/fixed-test.entity';
import { UsersModule } from '../users/users.module';
import { SixteenPfModule } from './16pf/16pf.module';
import { DiscModule } from './disc/disc.module';
import { WonderlicModule } from './wonderlic/wonderlic.module';
import { CfrModule } from './cfr/cfr.module';
import { IcModule } from './ic/ic.module';
import { VideoRequirementsModule } from './video-requirements/video-requirements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Test, TestQuestion, FixedTest]),
    UsersModule,
    SixteenPfModule,
    DiscModule,
    WonderlicModule,
    CfrModule,
    IcModule,
    VideoRequirementsModule,
  ],
  controllers: [TestsController],
  providers: [TestsService],
  exports: [TestsService],
})
export class TestsModule {}
