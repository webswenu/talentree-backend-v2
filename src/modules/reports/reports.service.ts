import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { createReadStream } from 'fs';
import { Report } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ApproveReportDto } from './dto/approve-report.dto';
import { ReportStatus } from '../../common/enums/report-status.enum';
import { UsersService } from '../users/users.service';
import { WorkerProcess } from '../workers/entities/worker-process.entity';
import { DocumentGeneratorService } from './document-generator.service';
import { S3Service } from '../../common/services/s3.service';
import { uploadBufferToS3, extractS3KeyFromUrl } from '../../common/helpers/s3.helper';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import {
  assertBelongsToUserCompany,
  isCompanyScopedRole,
  resolveUserCompanyId,
} from '../../common/helpers/ownership.helper';
import { esPdf } from '../../common/helpers/upload.helper';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(WorkerProcess)
    private readonly workerProcessRepository: Repository<WorkerProcess>,
    private readonly usersService: UsersService,
    private readonly documentGeneratorService: DocumentGeneratorService,
    private readonly s3Service: S3Service,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async create(
    createReportDto: CreateReportDto,
    userId: string,
  ): Promise<Report> {
    const { processId, workerId, ...reportData } = createReportDto;

    const user = await this.usersService.findOne(userId);

    const report = this.reportRepository.create({
      ...reportData,
      createdBy: user,
      process: processId ? ({ id: processId } as any) : null,
      worker: workerId ? ({ id: workerId } as any) : null,
      generatedDate: createReportDto.generatedDate
        ? new Date(createReportDto.generatedDate)
        : new Date(),
    });

    return this.reportRepository.save(report);
  }

  async findAll(requester?: any): Promise<Report[]> {
    return this.reportRepository.find({
      where: this.scopeFor(requester),
      relations: ['createdBy', 'process', 'process.company', 'worker', 'approvedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * El recorte que corresponde a quien pregunta, aplicado en la CONSULTA.
   *
   * Antes el unico recorte era `onlyApproved` para el rol COMPANY, con dos
   * agujeros: el rol GUEST quedaba fuera del filtro, y ninguno de los dos
   * filtraba por empresa. El resultado era que una empresa listaba los
   * informes de todas las demas.
   */
  private scopeFor(requester?: any): any {
    if (!requester || requester.role === UserRole.ADMIN_TALENTREE) return {};

    if (isCompanyScopedRole(requester.role)) {
      const companyId = resolveUserCompanyId(requester);
      return {
        status: ReportStatus.APPROVED,
        // Sin empresa asignada no se ve nada, en vez de verse todo.
        process: { company: { id: companyId ?? '00000000-0000-0000-0000-000000000000' } },
      };
    }

    return {};
  }

  async findOne(id: string, requester?: any): Promise<Report> {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: [
        'createdBy',
        // `approvedBy` SI se guarda al aprobar (ver approveReport), pero no
        // estaba en esta lista, asi que la API lo devolvia siempre en null y la
        // interfaz no podia mostrar quien aprobo. Para un documento que se le
        // entrega a una clienta, con nombre y RUT de una persona, saber quien
        // lo firmo no es un adorno.
        'approvedBy',
        'process',
        'process.company',
        'process.evaluators',
        'worker',
      ],
    });

    if (!report) {
      throw new NotFoundException(`Report con ID ${id} no encontrado`);
    }

    if (requester) {
      this.assertCanReadReport(report, requester);
    }

    return report;
  }

  /**
   * P-81. El informe psicotecnico es el dato mas sensible del producto y hasta
   * ahora se entregaba a cualquiera con rol COMPANY o GUEST, de cualquier
   * empresa y en cualquier estado. Dos comprobaciones, ambas necesarias:
   *
   *  1. Pertenencia: el informe tiene que ser de un proceso de SU empresa.
   *  2. Aprobacion : la empresa no lee borradores; solo lo que Talentree aprobo.
   */
  private assertCanReadReport(report: Report, requester: any): void {
    if (requester.role === UserRole.ADMIN_TALENTREE) return;

    if (isCompanyScopedRole(requester.role)) {
      assertBelongsToUserCompany(
        requester,
        report.process?.company?.id,
        'este informe',
      );

      if (report.status !== ReportStatus.APPROVED) {
        throw new ForbiddenException(
          'Este informe todavia no esta aprobado por Talentree.',
        );
      }
      return;
    }

    if (requester.role === UserRole.EVALUATOR) {
      const evaluators: any[] = report.process?.evaluators ?? [];
      const asignado = evaluators.some((e) => e?.id === requester.id);
      const esAutor = report.createdBy?.id === requester.id;

      if (!asignado && !esAutor) {
        throw new ForbiddenException(
          'Solo puedes ver los informes de los procesos que tienes asignados.',
        );
      }
    }
  }

  async findByType(type: string, requester?: any): Promise<Report[]> {
    return this.reportRepository.find({
      where: { ...this.scopeFor(requester), type: type as any },
      relations: ['createdBy', 'process', 'process.company', 'worker'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByProcess(processId: string, requester?: any): Promise<Report[]> {
    const whereCondition: any = {
      ...this.scopeFor(requester),
      process: { id: processId },
    };

    // El recorte por empresa se conserva junto con el filtro por proceso: si se
    // pisara la clave `process`, pedir un processId ajeno volveria a colar.
    const scoped = this.scopeFor(requester);
    if (scoped.process?.company) {
      whereCondition.process = {
        id: processId,
        company: scoped.process.company,
      };
    }

    return this.reportRepository.find({
      where: whereCondition,
      relations: ['createdBy', 'process', 'process.company', 'worker', 'approvedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByWorker(workerId: string, requester?: any): Promise<Report[]> {
    const whereCondition: any = {
      ...this.scopeFor(requester),
      worker: { id: workerId },
    };

    return this.reportRepository.find({
      where: whereCondition,
      relations: ['createdBy', 'process', 'process.company', 'approvedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, updateReportDto: UpdateReportDto): Promise<Report> {
    const report = await this.findOne(id);

    const { processId, workerId, ...reportData } = updateReportDto;

    Object.assign(report, reportData);

    if (processId !== undefined) {
      report.process = processId ? ({ id: processId } as any) : null;
    }

    if (workerId !== undefined) {
      report.worker = workerId ? ({ id: workerId } as any) : null;
    }

    return this.reportRepository.save(report);
  }

  async remove(id: string): Promise<void> {
    const report = await this.findOne(id);

    // Delete file if exists
    if (report.fileUrl) {
      const filePath = path.join(process.cwd(), report.fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await this.reportRepository.remove(report);
  }

  async uploadFile(
    id: string,
    file: Express.Multer.File,
    userId: string,
    userRole: string,
  ): Promise<Report> {
    const report = await this.findOne(id);

    // MIGRATE OLD REPORTS: If report has fileUrl but not docxFileUrl/pdfFileUrl, migrate it first
    if (report.fileUrl && !report.docxFileUrl && !report.pdfFileUrl) {
      const oldFileName = report.fileName?.toLowerCase() || '';
      if (oldFileName.endsWith('.pdf')) {
        // Old file is PDF
        report.pdfFileUrl = report.fileUrl;
        report.pdfFileName = report.fileName;
      } else {
        // Old file is DOCX
        report.docxFileUrl = report.fileUrl;
        report.docxFileName = report.fileName;
      }
    }

    // P-82: el tipo se decide por el CONTENIDO, no por la extension. El nombre
    // del archivo lo elige quien sube, asi que renombrar un .docx a .pdf
    // bastaba para que el informe quedara guardado en la columna equivocada.
    const isPdf = esPdf(file);

    // Get company ID for namespacing in S3
    const companyId = report.process?.company?.id;

    try {
      // Upload to S3
      const uploadResult = await uploadBufferToS3(
        this.s3Service,
        file.buffer,
        file.originalname,
        'reports',
        companyId,
      );

      this.logger.log(
        `Manual report uploaded to S3: ${uploadResult.key} for report ${id}`,
      );

      if (isPdf) {
        // Delete old PDF from S3 if exists
        if (report.pdfFileUrl) {
          try {
            const oldKey = extractS3KeyFromUrl(report.pdfFileUrl);
            await this.s3Service.deleteFile(oldKey);
          } catch (err) {
            this.logger.warn(`Could not delete old PDF: ${report.pdfFileUrl}`);
          }
        }
        // Save as PDF
        report.pdfFileUrl = uploadResult.url; // S3 public URL
        report.pdfFileName = file.originalname;
      } else {
        // Delete old DOCX from S3 if exists
        if (report.docxFileUrl) {
          try {
            const oldKey = extractS3KeyFromUrl(report.docxFileUrl);
            await this.s3Service.deleteFile(oldKey);
          } catch (err) {
            this.logger.warn(
              `Could not delete old DOCX: ${report.docxFileUrl}`,
            );
          }
        }
        // Save as DOCX
        report.docxFileUrl = uploadResult.url; // S3 public URL
        report.docxFileName = file.originalname;
      }

      // Keep deprecated fileUrl pointing to the S3 key for backward compatibility
      report.fileUrl = uploadResult.key; // S3 key for legacy support
      report.fileName = isPdf ? report.pdfFileName : report.docxFileName;

      // Update status based on user role
      if (userRole === 'evaluator') {
        // Evaluator uploads → status changes to REVISION_EVALUADOR (Admin must review)
        report.status = ReportStatus.REVISION_EVALUADOR;
      } else if (userRole === 'admin_talentree') {
        // Admin uploads → status changes to REVISION_ADMIN (ready for final review)
        report.status = ReportStatus.REVISION_ADMIN;
      }

      const savedReport = await this.reportRepository.save(report);

      // Notificar a los administradores solo si es PDF y está pendiente de aprobación
      if (
        isPdf &&
        (report.status === ReportStatus.PENDING_APPROVAL ||
          report.status === ReportStatus.REVISION_EVALUADOR ||
          report.status === ReportStatus.REVISION_ADMIN)
      ) {
        try {
          // Cargar relaciones necesarias
          const reportWithRelations = await this.reportRepository.findOne({
            where: { id },
            relations: ['worker', 'process', 'process.company'],
          });

          if (reportWithRelations) {
            const admins = await this.usersService.findAdminUsers();
            const adminIds = admins.map((admin) => admin.id);

            if (adminIds.length > 0) {
              await this.notificationsGateway.broadcastNotification(adminIds, {
                title: 'Reporte pendiente de aprobación',
                message: `Un nuevo reporte PDF para ${reportWithRelations.worker.firstName} ${reportWithRelations.worker.lastName} está listo para revisión`,
                type: NotificationType.REPORT_READY,
                link: `/admin/reportes`,
              });
            }

            /**
             * AQUI NO SE LE AVISA A LA EMPRESA, A PROPOSITO.
             *
             * Antes, al subir el PDF se le mandaba a la empresa un aviso que
             * decia «El reporte de X esta disponible» con enlace a
             * /empresa/reportes. Pero en este punto el informe queda en
             * REVISION_ADMIN o REVISION_EVALUADOR, y el recorte de empresa solo
             * deja ver los APROBADOS: la persona hacia clic y encontraba la
             * pantalla vacia.
             *
             * El aviso correcto va en `approveReport`, que es el momento en que
             * el informe pasa a ser visible para ella. El aviso a Talentree de
             * mas arriba si corresponde aqui: es justo lo que tiene que revisar.
             */
          }
        } catch (error) {
          this.logger.error(
            `Error sending notification for report pending approval: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      return savedReport;
    } catch (error) {
      this.logger.error(
        `Failed to upload file to S3: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException(
        'No se pudo subir el archivo. Intente nuevamente.',
      );
    }
  }

  async downloadFile(
    id: string,
    format?: 'pdf' | 'docx',
    requester?: any,
  ): Promise<{ stream: any; filename: string; mimetype: string }> {
    // El requester se pasa a findOne a proposito: la descarga entrega el
    // documento completo, asi que es el punto que MAS necesita la comprobacion,
    // no el que menos. Antes bajaba el archivo sin mirar empresa ni estado.
    const report = await this.findOne(id, requester);

    let fileUrl: string;
    let fileName: string;

    // If format is specified, use that specific file
    if (format === 'pdf') {
      if (!report.pdfFileUrl) {
        throw new NotFoundException('Este reporte no tiene archivo PDF asociado');
      }
      fileUrl = report.pdfFileUrl;
      fileName = report.pdfFileName || 'reporte.pdf';
    } else if (format === 'docx') {
      if (!report.docxFileUrl) {
        throw new NotFoundException('Este reporte no tiene archivo DOCX asociado');
      }
      fileUrl = report.docxFileUrl;
      fileName = report.docxFileName || 'reporte.docx';
    } else {
      // If no format specified, prefer PDF over DOCX
      if (report.pdfFileUrl) {
        fileUrl = report.pdfFileUrl;
        fileName = report.pdfFileName || 'reporte.pdf';
      } else if (report.docxFileUrl) {
        fileUrl = report.docxFileUrl;
        fileName = report.docxFileName || 'reporte.docx';
      } else {
        throw new NotFoundException('Este reporte no tiene archivo asociado');
      }
    }

    this.logger.log(`Attempting to download report ${id}, fileUrl: ${fileUrl}`);

    // Extract S3 key from URL or use as-is
    const key = extractS3KeyFromUrl(fileUrl);
    this.logger.log(`Extracted S3 key: ${key}`);

    // If it's an S3 key (starts with 'reports/'), download from S3
    if (key && key.startsWith('reports/')) {
      try {
        this.logger.log(`Downloading from S3 with key: ${key}`);
        const stream = await this.s3Service.getFileStream(key);
        const mimetype = this.getMimeType(fileName);
        this.logger.log(`Successfully retrieved report stream from S3: ${key}`);
        return { stream, filename: fileName, mimetype };
      } catch (error) {
        this.logger.error(
          `Failed to download report from S3 (key: ${key}): ${error instanceof Error ? error.message : String(error)}`,
        );
        throw new NotFoundException('No se pudo descargar el reporte desde S3');
      }
    } else {
      // Legacy: File is in local filesystem
      this.logger.log(`Attempting to read report from local filesystem: ${fileUrl}`);
      const filePath = path.join(process.cwd(), fileUrl);

      if (!fs.existsSync(filePath)) {
        this.logger.error(`Local report file not found at path: ${filePath}`);
        throw new NotFoundException('El archivo no existe en el servidor');
      }

      const stream = createReadStream(filePath);
      const mimetype = this.getMimeType(fileName);
      return { stream, filename: fileName, mimetype };
    }
  }

  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  async approveReport(
    id: string,
    approveDto: ApproveReportDto,
    userId: string,
  ): Promise<Report> {
    const report = await this.findOne(id);
    const user = await this.usersService.findOne(userId);

    report.status = approveDto.status;

    if (approveDto.status === ReportStatus.APPROVED) {
      report.approvedBy = user;
      report.approvedAt = new Date();
      report.rejectionReason = null;
    } else if (approveDto.status === ReportStatus.REJECTED) {
      report.rejectionReason = approveDto.rejectionReason;
      report.approvedBy = null;
      report.approvedAt = null;
    }

    const guardado = await this.reportRepository.save(report);

    if (guardado.status === ReportStatus.APPROVED) {
      await this.avisarALaEmpresaQueElInformeEstaDisponible(guardado.id);
    }

    return guardado;
  }

  /**
   * Le avisa a la empresa recien cuando el informe queda aprobado, que es el
   * momento en que de verdad puede verlo.
   *
   * Antes el aviso salia al subir el PDF, con el informe todavia en revision:
   * la persona hacia clic y encontraba la pantalla vacia, porque su recorte
   * solo muestra los APROBADOS. Y en el momento en que si pasaba a ser visible,
   * no se enteraba nadie.
   *
   * El fallo del aviso no puede tumbar la aprobacion: el informe ya quedo
   * guardado y aprobado, y no avisar es molesto pero no invalida la operacion.
   */
  private async avisarALaEmpresaQueElInformeEstaDisponible(
    reportId: string,
  ): Promise<void> {
    try {
      const informe = await this.reportRepository.findOne({
        where: { id: reportId },
        relations: ['worker', 'process', 'process.company'],
      });

      const companyId = informe?.process?.company?.id;
      if (!companyId) return;

      const usuarios = await this.usersService.findCompanyUsers(companyId);
      const ids = usuarios.map((u) => u.id);
      if (ids.length === 0) return;

      const candidato = [informe.worker?.firstName, informe.worker?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();

      await this.notificationsGateway.broadcastNotification(ids, {
        title: 'Informe disponible',
        message: candidato
          ? `El informe de evaluación de ${candidato} ya está disponible para descargar.`
          : 'Hay un nuevo informe de evaluación disponible para descargar.',
        type: NotificationType.REPORT_READY,
        link: '/empresa/reportes',
      });
    } catch (error) {
      this.logger.error(
        `No se pudo avisar a la empresa del informe ${reportId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Preview: Genera el DOCX sin subir a S3 (para pruebas de diseño)
   */
  async previewReport(workerProcessId: string): Promise<Buffer> {
    const workerProcess = await this.workerProcessRepository.findOne({
      where: { id: workerProcessId },
      relations: [
        'worker',
        'worker.user',
        'process',
        'process.company',
        'testResponses',
        'testResponses.test',
        'testResponses.fixedTest',
      ],
    });

    if (!workerProcess) {
      throw new NotFoundException(
        `WorkerProcess con ID ${workerProcessId} no encontrado`,
      );
    }

    // Generar y devolver el buffer directamente
    return this.documentGeneratorService.generateWorkerProcessReport(workerProcess);
  }

  async generateReport(workerProcessId: string): Promise<Report> {
    // Fetch WorkerProcess with all necessary relations
    const workerProcess = await this.workerProcessRepository.findOne({
      where: { id: workerProcessId },
      relations: [
        'worker',
        'worker.user',
        'process',
        'process.company',
        'testResponses',
        'testResponses.test',
        'testResponses.fixedTest',
      ],
    });

    if (!workerProcess) {
      throw new NotFoundException(
        `WorkerProcess con ID ${workerProcessId} no encontrado`,
      );
    }

    if (!workerProcess.worker) {
      throw new BadRequestException(
        'El proceso no tiene un trabajador asociado',
      );
    }

    // Identify incomplete tests
    const incompleteTests = workerProcess.testResponses?.filter(
      (tr) => !tr.isCompleted,
    ) || [];

    // Log incomplete tests if any
    if (incompleteTests.length > 0) {
      this.logger.warn(
        `Generating report with ${incompleteTests.length} incomplete test(s) for WorkerProcess ${workerProcessId}`,
      );
    }

    // Generate DOCX document (including incomplete tests information)
    const docxBuffer =
      await this.documentGeneratorService.generateWorkerProcessReport(
        workerProcess,
      );

    // Upload DOCX to S3
    const fileName = `reporte-${workerProcess.worker.firstName}-${workerProcess.worker.lastName}-${Date.now()}.docx`;
    const companyId = workerProcess.process?.company?.id;

    try {
      const uploadResult = await uploadBufferToS3(
        this.s3Service,
        docxBuffer,
        fileName,
        'reports',
        companyId,
      );

      this.logger.log(
        `Report uploaded to S3: ${uploadResult.key} for worker ${workerProcess.worker.firstName}`,
      );

      // Create Report entity
      const report = this.reportRepository.create({
        title: `Informe de Evaluación - ${workerProcess.worker.firstName} ${workerProcess.worker.lastName}`,
        description: `Reporte psicotécnico generado automáticamente para el proceso "${workerProcess.process?.name}"`,
        type: 'worker_evaluation' as any,
        status: ReportStatus.PENDING_APPROVAL,
        docxFileUrl: uploadResult.url, // S3 public URL
        docxFileName: fileName,
        // Keep old fields for backward compatibility (store S3 key for future reference)
        fileUrl: uploadResult.key, // S3 key for deletion/management
        fileName: fileName,
        generatedDate: new Date(),
        createdBy: workerProcess.worker.user,
        process: workerProcess.process,
        worker: workerProcess.worker,
      });

      const savedReport = await this.reportRepository.save(report);

      // Notificar al trabajador que su reporte está listo
      try {
        const workerUserId = workerProcess.worker.user?.id;
        if (workerUserId) {
          await this.notificationsGateway.broadcastNotification([workerUserId], {
            title: 'Tu reporte está listo',
            message: `Tu informe de evaluación para el proceso "${workerProcess.process?.name}" ha sido generado y está en revisión`,
            type: NotificationType.REPORT_READY,
            link: `/trabajador/resultados`,
          });
        }
      } catch (error) {
        this.logger.error(
          `Error sending notification to worker for report ready: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      return savedReport;
    } catch (error) {
      this.logger.error(
        `Failed to upload report to S3: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException(
        'No se pudo subir el reporte. Intente nuevamente.',
      );
    }
  }
}
