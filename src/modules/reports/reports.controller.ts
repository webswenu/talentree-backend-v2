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
  BadRequestException,
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
import {
  filtroDocumentoInforme,
  verificarFirmaDocumento,
  TAMANO_MAXIMO_INFORME,
} from '../../common/helpers/upload.helper';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  create(@Body() createReportDto: CreateReportDto, @Request() req) {
    return this.reportsService.create(createReportDto, req.user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  findAll(@Request() req) {
    // Se pasa el usuario entero, no solo un booleano: el recorte necesita
    // saber de que empresa es, no unicamente si puede ver borradores.
    return this.reportsService.findAll(req.user);
  }

  @Get('type/:type')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  findByType(@Param('type') type: string, @Request() req) {
    return this.reportsService.findByType(type, req.user);
  }

  @Get('process/:processId')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  findByProcess(@Param('processId') processId: string, @Request() req) {
    return this.reportsService.findByProcess(processId, req.user);
  }

  @Get('worker/:workerId')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  findByWorker(@Param('workerId') workerId: string, @Request() req) {
    return this.reportsService.findByWorker(workerId, req.user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  findOne(@Param('id') id: string, @Request() req) {
    return this.reportsService.findOne(id, req.user);
  }

  // Editar un informe es escritura: el Invitado queda fuera, y la empresa
  // tampoco edita un informe que emite Talentree.
  @Patch(':id')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  update(@Param('id') id: string, @Body() updateReportDto: UpdateReportDto) {
    return this.reportsService.update(id, updateReportDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN_TALENTREE)
  remove(@Param('id') id: string) {
    return this.reportsService.remove(id);
  }

  // P-82. Antes era FileInterceptor('file') pelado: sin limite de tamano y sin
  // filtro de formato. Se acepto un .exe y quedo guardado como el documento del
  // informe, y un archivo de 60 MB entro sin problema.
  @Post(':id/upload')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: TAMANO_MAXIMO_INFORME },
      fileFilter: filtroDocumentoInforme,
    }),
  )
  uploadFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('No se recibio ningun archivo.');
    }

    // El MIME lo declara el navegador y se puede falsear: la segunda barrera
    // mira los bytes de cabecera del archivo.
    verificarFirmaDocumento(file);

    return this.reportsService.uploadFile(id, file, req.user.id, req.user.role);
  }

  @Get(':id/download')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  async downloadFile(
    @Param('id') id: string,
    @Query('format') format: 'pdf' | 'docx',
    @Res() res: Response,
    @Request() req,
  ) {
    const { stream, filename, mimetype } =
      await this.reportsService.downloadFile(id, format, req.user);

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
