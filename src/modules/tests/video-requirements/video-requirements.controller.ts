import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/common/enums/user-role.enum';
import { VideoRequirementsService } from './video-requirements.service';
import { UploadVideoDto, ReviewVideoDto } from '../shared/dtos';
import { VideoRequirementStatus } from '../entities/worker-video-requirement.entity';

@Controller('video-requirements')
@UseGuards(JwtAuthGuard)
export class VideoRequirementsController {
  constructor(
    private readonly videoRequirementsService: VideoRequirementsService,
  ) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.WORKER)
  async uploadVideo(@Body() uploadDto: UploadVideoDto, @Request() req) {
    return this.videoRequirementsService.uploadVideo(
      uploadDto,
      req.user.id,
    );
  }

  @Post('upload-file')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.WORKER)
  @UseInterceptors(
    FileInterceptor('video', {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
    }),
  )
  async uploadVideoFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('workerId') workerId: string,
    @Body('processId') processId: string,
    @Body('workerProcessId') workerProcessId: string,
    @Body('videoDuration') videoDuration: string,
    @Request() req,
  ) {
    return this.videoRequirementsService.uploadVideoFile(
      file,
      workerId,
      processId,
      workerProcessId,
      parseInt(videoDuration),
      req.user.id,
    );
  }

  @Get('worker/:workerId/process/:processId/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.WORKER, UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  async getWorkerStatus(
    @Param('workerId') workerId: string,
    @Param('processId') processId: string,
    @Query('workerProcessId') workerProcessId?: string,
  ) {
    return this.videoRequirementsService.getWorkerVideoStatus(
      workerId,
      processId,
      workerProcessId,
    );
  }

  @Get('worker/:workerId/process/:processId/can-access-tests')
  async canAccessTests(
    @Param('workerId') workerId: string,
    @Param('processId') processId: string,
    @Query('workerProcessId') workerProcessId?: string,
  ) {
    const canAccess =
      await this.videoRequirementsService.canWorkerAccessTests(
        workerId,
        processId,
        workerProcessId,
      );
    return { canAccess };
  }

  @Get('process/:processId')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.EVALUATOR,
    UserRole.COMPANY,
    UserRole.GUEST,
  )
  async getVideosByProcess(@Param('processId') processId: string) {
    return this.videoRequirementsService.getVideosByProcess(processId);
  }

  @Get('worker/:workerId/process/:processId')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.WORKER,
    UserRole.ADMIN_TALENTREE,
    UserRole.EVALUATOR,
    UserRole.COMPANY,
    UserRole.GUEST,
  )
  async getWorkerVideoForProcess(
    @Param('workerId') workerId: string,
    @Param('processId') processId: string,
  ) {
    return this.videoRequirementsService.getWorkerVideoForProcess(
      workerId,
      processId,
    );
  }

  @Get('worker/:workerId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.WORKER, UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  async getWorkerVideos(@Param('workerId') workerId: string) {
    return this.videoRequirementsService.getWorkerVideos(workerId);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  async getPendingReviews() {
    return this.videoRequirementsService.getPendingReviews();
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  async getAllVideos(@Query('status') status?: VideoRequirementStatus) {
    return this.videoRequirementsService.getAllVideos(status);
  }

  @Put(':videoId/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  async reviewVideo(
    @Param('videoId') videoId: string,
    @Body() reviewDto: ReviewVideoDto,
    @Request() req,
  ) {
    return this.videoRequirementsService.reviewVideo(
      videoId,
      reviewDto,
      req.user.userId,
    );
  }

  @Delete(':videoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_TALENTREE)
  async deleteVideo(@Param('videoId') videoId: string) {
    await this.videoRequirementsService.deleteVideo(videoId);
  }

  @Get(':videoId/download')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.EVALUATOR,
    UserRole.COMPANY,
    UserRole.WORKER,
    UserRole.GUEST,
  )
  async downloadVideo(@Param('videoId') videoId: string, @Res() res: Response) {
    const { stream, filename } = await this.videoRequirementsService.downloadVideo(videoId);

    res.set({
      'Content-Type': 'video/webm',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    stream.pipe(res);
  }
}
