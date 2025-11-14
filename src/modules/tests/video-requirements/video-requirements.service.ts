import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WorkerVideoRequirement,
  VideoRequirementStatus,
} from '../entities/worker-video-requirement.entity';
import { Worker } from '../../workers/entities/worker.entity';
import { UploadVideoDto, ReviewVideoDto } from '../shared/dtos';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { S3Service } from '../../../common/services/s3.service';
import { uploadFileAndGetPublicUrl, extractS3KeyFromUrl } from '../../../common/helpers/s3.helper';

const execPromise = promisify(exec);

@Injectable()
export class VideoRequirementsService {
  private readonly logger = new Logger(VideoRequirementsService.name);

  constructor(
    @InjectRepository(WorkerVideoRequirement)
    private readonly videoRequirementRepository: Repository<WorkerVideoRequirement>,
    @InjectRepository(Worker)
    private readonly workerRepository: Repository<Worker>,
    private readonly s3Service: S3Service,
  ) {}

  async uploadVideo(
    uploadDto: UploadVideoDto,
    userId: string,
  ): Promise<WorkerVideoRequirement> {
    const worker = await this.workerRepository.findOne({
      where: { id: uploadDto.workerId },
      relations: ['user'],
    });

    if (!worker) {
      throw new NotFoundException('Worker not found');
    }

    if (worker.user.id !== userId) {
      throw new ForbiddenException(
        'You can only upload videos for your own profile',
      );
    }

    // Verificar si ya existe un video para este worker en este proceso
    const existingVideo = await this.videoRequirementRepository.findOne({
      where: {
        workerId: uploadDto.workerId,
        processId: uploadDto.processId,
      },
    });

    if (existingVideo) {
      throw new BadRequestException(
        'Ya existe un video para este proceso. No puedes subir uno nuevo.',
      );
    }

    const videoRequirement = this.videoRequirementRepository.create({
      workerId: uploadDto.workerId,
      processId: uploadDto.processId,
      workerProcessId: uploadDto.workerProcessId || null,
      videoUrl: uploadDto.videoUrl,
      videoDuration: uploadDto.videoDuration,
      videoSize: uploadDto.videoSize,
      deviceInfo: uploadDto.deviceInfo,
      // IMPORTANTE: El status ya no es PENDING_REVIEW, es APPROVED automáticamente
      // porque los tests se desbloquean inmediatamente después de subir el video
      status: VideoRequirementStatus.APPROVED,
      reviewedAt: new Date(),
    });

    return this.videoRequirementRepository.save(videoRequirement);
  }

  async getWorkerVideoStatus(
    workerId: string,
    processId: string,
    workerProcessId?: string,
  ): Promise<{
    hasVideo: boolean;
    status: VideoRequirementStatus | null;
    video: WorkerVideoRequirement | null;
    canAccessTests: boolean;
  }> {
    // Si se proporciona workerProcessId, verificar por ese ID específico
    // Esto asegura que cada postulación requiere su propio video
    const whereCondition = workerProcessId
      ? { workerProcessId }
      : { workerId, processId };

    const video = await this.videoRequirementRepository.findOne({
      where: whereCondition,
      order: { createdAt: 'DESC' },
    });

    // Los tests se desbloquean si existe un video (siempre aprobado automáticamente)
    const canAccessTests = !!video;

    return {
      hasVideo: !!video,
      status: video?.status || null,
      video,
      canAccessTests,
    };
  }

  async reviewVideo(
    videoId: string,
    reviewDto: ReviewVideoDto,
    reviewerId: string,
  ): Promise<WorkerVideoRequirement> {
    const video = await this.videoRequirementRepository.findOne({
      where: { id: videoId },
    });

    if (!video) {
      throw new NotFoundException('Video requirement not found');
    }

    video.status = reviewDto.status as VideoRequirementStatus;
    video.reviewNotes = reviewDto.reviewNotes;
    video.reviewedAt = new Date();
    video.reviewedById = reviewerId;

    return this.videoRequirementRepository.save(video);
  }

  async getPendingReviews(): Promise<WorkerVideoRequirement[]> {
    return this.videoRequirementRepository.find({
      where: { status: VideoRequirementStatus.PENDING_REVIEW },
      relations: ['worker', 'worker.user'],
      order: { createdAt: 'ASC' },
    });
  }

  async getWorkerVideos(workerId: string): Promise<WorkerVideoRequirement[]> {
    return this.videoRequirementRepository.find({
      where: { workerId },
      relations: ['reviewedBy', 'process'],
      order: { createdAt: 'DESC' },
    });
  }

  async getVideosByProcess(
    processId: string,
  ): Promise<WorkerVideoRequirement[]> {
    return this.videoRequirementRepository.find({
      where: { processId },
      relations: ['worker', 'worker.user', 'reviewedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getWorkerVideoForProcess(
    workerId: string,
    processId: string,
  ): Promise<WorkerVideoRequirement | null> {
    return this.videoRequirementRepository.findOne({
      where: { workerId, processId },
      relations: ['reviewedBy', 'process', 'workerProcess'],
    });
  }

  async canWorkerAccessTests(
    workerId: string,
    processId: string,
    workerProcessId?: string,
  ): Promise<boolean> {
    // Si se proporciona workerProcessId, verificar por ese ID específico
    const whereCondition = workerProcessId
      ? { workerProcessId }
      : { workerId, processId };

    const video = await this.videoRequirementRepository.findOne({
      where: whereCondition,
    });

    // Si existe un video para este workerProcess específico, puede acceder a los tests
    return !!video;
  }

  async getAllVideos(
    status?: VideoRequirementStatus,
  ): Promise<WorkerVideoRequirement[]> {
    const where = status ? { status } : {};

    return this.videoRequirementRepository.find({
      where,
      relations: ['worker', 'worker.user', 'reviewedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async deleteVideo(videoId: string): Promise<void> {
    const video = await this.videoRequirementRepository.findOne({
      where: { id: videoId },
    });

    if (!video) {
      throw new NotFoundException('Video requirement not found');
    }

    await this.videoRequirementRepository.remove(video);
  }

  async uploadVideoFile(
    file: Express.Multer.File,
    workerId: string,
    processId: string,
    workerProcessId: string,
    videoDuration: number,
    userId: string,
  ): Promise<WorkerVideoRequirement> {
    const worker = await this.workerRepository.findOne({
      where: { id: workerId },
      relations: ['user'],
    });

    if (!worker) {
      throw new NotFoundException('Worker not found');
    }

    if (worker.user.id !== userId) {
      throw new ForbiddenException(
        'You can only upload videos for your own profile',
      );
    }

    // Check if video already exists
    const existingVideo = await this.videoRequirementRepository.findOne({
      where: { workerId, processId },
    });

    if (existingVideo) {
      throw new BadRequestException(
        'Ya existe un video para este proceso. No puedes subir uno nuevo.',
      );
    }

    try {
      // Upload video to S3
      this.logger.log(`Uploading video to S3 for worker ${workerId} in process ${processId}`);

      const uploadResult = await uploadFileAndGetPublicUrl(
        this.s3Service,
        file,
        'videos',
        workerId,
      );

      this.logger.log(`Video uploaded to S3: ${uploadResult.key}`);

      // Save to database with S3 URL
      const videoRequirement = this.videoRequirementRepository.create({
        workerId,
        processId,
        workerProcessId: workerProcessId || null,
        videoUrl: uploadResult.url,
        videoDuration,
        videoSize: file.size,
        deviceInfo: {
          userAgent: 'S3 Upload',
          originalSize: file.size,
          format: 'webm',
          s3Key: uploadResult.key,
        },
        status: VideoRequirementStatus.APPROVED,
        reviewedAt: new Date(),
      });

      return this.videoRequirementRepository.save(videoRequirement);
    } catch (error) {
      this.logger.error(
        `Failed to upload video: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException(
        `Error processing video: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async downloadVideo(videoId: string): Promise<{ stream: any; filename: string }> {
    const video = await this.videoRequirementRepository.findOne({
      where: { id: videoId },
    });

    if (!video) {
      throw new NotFoundException('Video requirement not found');
    }

    if (!video.videoUrl) {
      throw new NotFoundException('Video URL not found');
    }

    this.logger.log(`Attempting to download video ${videoId}, videoUrl: ${video.videoUrl}`);

    // Extract S3 key from URL or use as-is
    const key = extractS3KeyFromUrl(video.videoUrl);
    this.logger.log(`Extracted S3 key: ${key}`);

    // If it's an S3 key (starts with 'videos/'), download from S3
    if (key && key.startsWith('videos/')) {
      try {
        this.logger.log(`Downloading from S3 with key: ${key}`);
        const stream = await this.s3Service.getFileStream(key);
        const filename = key.split('/').pop() || 'video.webm';
        this.logger.log(`Successfully retrieved video stream from S3: ${key}`);
        return { stream, filename };
      } catch (error) {
        this.logger.error(
          `Failed to download video from S3 (key: ${key}): ${error instanceof Error ? error.message : String(error)}`,
        );
        throw new NotFoundException('No se pudo descargar el video desde S3');
      }
    }

    // If it's a local file (legacy), read from filesystem
    this.logger.log(`Attempting to read video from local filesystem: ${video.videoUrl}`);
    const videoPath = path.join(process.cwd(), video.videoUrl);
    if (!fs.existsSync(videoPath)) {
      this.logger.error(`Local video file not found at path: ${videoPath}`);
      throw new NotFoundException('El archivo de video no existe en el servidor');
    }

    const stream = fs.createReadStream(videoPath);
    const filename = path.basename(videoPath);
    return { stream, filename };
  }
}
