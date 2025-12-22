import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ApproveReportDto } from './dto/approve-report.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  create(@Body() createReportDto: CreateReportDto, @Request() req) {
    return this.reportsService.create(createReportDto, req.user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  findAll(@Request() req) {
    const userRole = req.user.role;
    const onlyApproved = userRole === UserRole.COMPANY;
    return this.reportsService.findAll(onlyApproved);
  }

  @Get('type/:type')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  findByType(@Param('type') type: string) {
    return this.reportsService.findByType(type);
  }

  @Get('process/:processId')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  findByProcess(@Param('processId') processId: string, @Request() req) {
    const userRole = req.user.role;
    const onlyApproved = userRole === UserRole.COMPANY;
    return this.reportsService.findByProcess(processId, onlyApproved);
  }

  @Get('worker/:workerId')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  findByWorker(@Param('workerId') workerId: string, @Request() req) {
    const userRole = req.user.role;
    const onlyApproved = userRole === UserRole.COMPANY;
    return this.reportsService.findByWorker(workerId, onlyApproved);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  update(@Param('id') id: string, @Body() updateReportDto: UpdateReportDto) {
    return this.reportsService.update(id, updateReportDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN_TALENTREE)
  remove(@Param('id') id: string) {
    return this.reportsService.remove(id);
  }

  @Post(':id/upload')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    return this.reportsService.uploadFile(id, file, req.user.id, req.user.role);
  }

  @Get(':id/download')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  async downloadFile(
    @Param('id') id: string,
    @Query('format') format: 'pdf' | 'docx',
    @Res() res: Response,
  ) {
    const { stream, filename, mimetype } =
      await this.reportsService.downloadFile(id, format);

    res.set({
      'Content-Type': mimetype,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    stream.pipe(res);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN_TALENTREE)
  approveReport(
    @Param('id') id: string,
    @Body() approveDto: ApproveReportDto,
    @Request() req,
  ) {
    return this.reportsService.approveReport(id, approveDto, req.user.id);
  }

  @Post('generate/:workerProcessId')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  generateReport(@Param('workerProcessId') workerProcessId: string) {
    return this.reportsService.generateReport(workerProcessId);
  }

  /**
   * Endpoint de prueba: Genera el DOCX y lo descarga directamente sin subir a S3
   * Útil para probar el diseño del documento
   */
  @Get('preview/:workerProcessId')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  async previewReport(
    @Param('workerProcessId') workerProcessId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.previewReport(workerProcessId);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="preview-reporte-${workerProcessId}.docx"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
