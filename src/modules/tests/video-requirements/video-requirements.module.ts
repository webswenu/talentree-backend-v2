import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkerVideoRequirement } from '../entities/worker-video-requirement.entity';
import { Worker } from '../../workers/entities/worker.entity';
import { VideoRequirementsController } from './video-requirements.controller';
import { VideoRequirementsService } from './video-requirements.service';
import { S3Service } from '../../../common/services/s3.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkerVideoRequirement, Worker])],
  controllers: [VideoRequirementsController],
  providers: [VideoRequirementsService, S3Service],
  exports: [VideoRequirementsService],
})
export class VideoRequirementsModule {}
