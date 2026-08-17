import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { DatabaseSeeder } from './database.seeder';
import { UserSeeder } from './user.seeder';
import { CompanySeeder } from './company.seeder';
import { ProcessSeeder } from './process.seeder';
import { TestSeeder } from './test.seeder';
import { RelationsSeeder } from './relations.seeder';

import { User } from '../../modules/users/entities/user.entity';
import { Company } from '../../modules/companies/entities/company.entity';
import { SelectionProcess } from '../../modules/processes/entities/selection-process.entity';
import { Test } from '../../modules/tests/entities/test.entity';
import { TestQuestion } from '../../modules/tests/entities/test-question.entity';
import { Worker } from '../../modules/workers/entities/worker.entity';
import { WorkerProcess } from '../../modules/workers/entities/worker-process.entity';
import { getDatabaseConfig } from '../../config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),

    TypeOrmModule.forFeature([
      User,
      Company,
      SelectionProcess,
      Test,
      TestQuestion,
      Worker,
      WorkerProcess,
    ]),
  ],
  providers: [
    DatabaseSeeder,
    UserSeeder,
    CompanySeeder,
    ProcessSeeder,
    TestSeeder,
    RelationsSeeder,
  ],
  exports: [DatabaseSeeder],
})
export class SeederModule {}
