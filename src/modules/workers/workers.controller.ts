import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
  Query,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { WorkersService } from './workers.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { ApplyToProcessDto } from './dto/apply-to-process.dto';
import { UpdateWorkerProcessStatusDto } from './dto/update-worker-process-status.dto';
import { WorkerFilterDto } from './dto/worker-filter.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('workers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Post()
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.GUEST)
  create(@Body() createWorkerDto: CreateWorkerDto) {
    return this.workersService.create(createWorkerDto);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  getStats() {
    return this.workersService.getStats();
  }

  @Get()
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY, UserRole.GUEST,
    UserRole.EVALUATOR,
    UserRole.GUEST,
  )
  findAll(@Query() filters: WorkerFilterDto) {
    return this.workersService.findAll(filters);
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY, UserRole.GUEST,
    UserRole.EVALUATOR,
    UserRole.WORKER,
    UserRole.GUEST,
  )
  findOne(@Param('id') id: string) {
    return this.workersService.findOne(id);
  }

  @Get('email/:email')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  findByEmail(@Param('email') email: string) {
    return this.workersService.findByEmail(email);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.WORKER, UserRole.GUEST)
  update(@Param('id') id: string, @Body() updateWorkerDto: UpdateWorkerDto) {
    return this.workersService.update(id, updateWorkerDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN_TALENTREE)
  remove(@Param('id') id: string) {
    return this.workersService.remove(id);
  }

  @Post('apply-to-process')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.WORKER, UserRole.GUEST)
  applyToProcess(@Body() applyDto: ApplyToProcessDto) {
    return this.workersService.applyToProcess(applyDto);
  }

  @Get(':workerId/dashboard-stats')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY, UserRole.GUEST,
    UserRole.EVALUATOR,
    UserRole.WORKER,
  )
  getDashboardStats(@Param('workerId') workerId: string) {
    return this.workersService.getDashboardStats(workerId);
  }

  @Get(':workerId/processes')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY, UserRole.GUEST,
    UserRole.EVALUATOR,
    UserRole.WORKER,
  )
  getWorkerProcesses(@Param('workerId') workerId: string) {
    return this.workersService.getWorkerProcesses(workerId);
  }

  @Get('process/:processId/workers')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY, UserRole.GUEST,
    UserRole.EVALUATOR,
    UserRole.GUEST,
  )
  getProcessWorkers(@Param('processId') processId: string) {
    return this.workersService.getProcessWorkers(processId);
  }

  /**
   * Obtiene información de cupos de un proceso (máximos, ocupados, disponibles)
   */
  @Get('process/:processId/capacity')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY,
    UserRole.EVALUATOR,
    UserRole.GUEST,
  )
  getProcessCapacity(@Param('processId') processId: string) {
    return this.workersService.getProcessCapacity(processId);
  }

  @Patch('worker-process/:id/status')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  updateWorkerProcessStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateWorkerProcessStatusDto,
  ) {
    return this.workersService.updateWorkerProcessStatus(id, updateDto);
  }

  @Get('worker-process/:id')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY, UserRole.GUEST,
    UserRole.EVALUATOR,
    UserRole.WORKER,
  )
  getWorkerProcessById(@Param('id') id: string) {
    return this.workersService.getWorkerProcessById(id);
  }

  @Post(':id/upload-cv')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.WORKER, UserRole.GUEST)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  uploadCV(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: 'application/pdf' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.workersService.uploadCV(id, file);
  }

  @Delete(':id/cv')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.WORKER, UserRole.GUEST)
  @HttpCode(HttpStatus.OK)
  async deleteCV(@Param('id') id: string) {
    return this.workersService.deleteCV(id);
  }

  @Get(':id/cv')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY, UserRole.GUEST,
    UserRole.EVALUATOR,
    UserRole.WORKER,
  )
  async downloadCV(@Param('id') id: string, @Res() res: Response) {
    const { stream, filename } = await this.workersService.downloadCV(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    stream.pipe(res);
  }
}
