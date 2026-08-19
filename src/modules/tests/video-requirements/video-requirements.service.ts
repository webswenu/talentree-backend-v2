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
import { SelectionProcess } from '../../processes/entities/selection-process.entity';
import { assertPuedeAccederAPostulacion } from '../../../common/helpers/ownership.helper';
import { UploadVideoDto, ReviewVideoDto } from '../shared/dtos';
import { exec } from 'child_process';
import { promisify } from 'util';
// `fs` y `path` se quitaron al eliminar la lectura de videos desde el disco:
// este modulo ya no toca el sistema de archivos, y conviene que ni siquiera lo
// tenga a mano.
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
      throw new NotFoundException('No encontramos el perfil del candidato.');
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

    /**
     * La ubicacion del video la elige quien sube, asi que se comprueba ANTES de
     * guardarla: si no apunta a nuestra carpeta de videos, no entra a la base.
     *
     * La descarga tambien lo comprueba por su cuenta. Son dos capas a
     * proposito: esta impide que quede guardada una ubicacion invalida, y la
     * otra protege a las filas que ya estuvieran guardadas de antes.
     */
    const claveDelVideo = extractS3KeyFromUrl(uploadDto.videoUrl);

    if (!this.esClaveDeVideoValida(claveDelVideo)) {
      this.logger.warn(
        `Intento de guardar un video con una ubicación fuera del almacenamiento: ${uploadDto.videoUrl}`,
      );
      throw new BadRequestException(
        'La ubicación del video no es válida. Vuelve a grabarlo desde la plataforma.',
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
      throw new NotFoundException('Este proceso no tiene configurado el requisito de video.');
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
      throw new NotFoundException('Este proceso no tiene configurado el requisito de video.');
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
      throw new NotFoundException('No encontramos el perfil del candidato.');
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

  async downloadVideo(
    videoId: string,
    user?: any,
  ): Promise<{ stream: any; filename: string }> {
    const video = await this.videoRequirementRepository.findOne({
      where: { id: videoId },
    });

    if (!video) {
      throw new NotFoundException('Este proceso no tiene configurado el requisito de video.');
    }

    /**
     * Este endpoint no comprobaba de quien era el video: con el id, cualquier
     * candidato descargaba la entrevista en video de otro. Es el mismo defecto
     * que tenian las respuestas de test, y se cierra con la misma funcion.
     *
     * El dueño se resuelve desde el candidato y el proceso guardados en la
     * fila, que siempre estan; `workerProcessId` es opcional y no sirve como
     * unica fuente.
     */
    const candidato = await this.workerRepository.findOne({
      where: { id: video.workerId },
      relations: ['user'],
    });

    const proceso = await this.workerRepository.manager
      .getRepository(SelectionProcess)
      .findOne({
        where: { id: video.processId },
        relations: { company: true, evaluators: true },
      });

    assertPuedeAccederAPostulacion(
      user,
      {
        usuarioDelCandidato: candidato?.user?.id,
        empresaDelProceso: proceso?.company?.id,
        evaluadoresDelProceso: (proceso?.evaluators || []).map((e) => e.id),
      },
      'este video',
    );

    if (!video.videoUrl) {
      throw new NotFoundException('Este candidato todavia no ha subido su video.');
    }

    const key = extractS3KeyFromUrl(video.videoUrl);

    /**
     * SE ELIMINO LA RAMA DE ARCHIVO LOCAL, Y ESE ERA EL AGUJERO.
     *
     * Antes, cuando la clave no empezaba con `videos/`, se caia a leer del
     * disco con `path.join(process.cwd(), video.videoUrl)`, sin normalizar ni
     * comprobar que quedara dentro de ninguna carpeta. Y `videoUrl` lo elige
     * quien sube el video: el DTO solo pedia `@IsUrl()`.
     *
     * Verificado el 18-08-2026 ejecutando el validador real:
     *   '../../../../etc/passwd'            -> lo rechaza @IsUrl()
     *   'http://a.com/../../../etc/passwd'  -> `new URL()` normaliza y no escapa
     *   'a.com/../../../../etc/passwd'      -> PASA @IsUrl() (URL sin protocolo),
     *      `extractS3KeyFromUrl` la devuelve tal cual porque no tiene '://',
     *      y `path.join` resuelve a /etc/passwd.
     *
     * El rol que puede subir es WORKER, que es de registro publico. En ese host
     * el .env tiene JWT_SECRET, la base de datos, las llaves de AWS y la clave
     * del correo: con el secreto se firman tokens de administrador.
     *
     * No se "contiene" la ruta: se saca. Los videos viven en S3 y en produccion
     * no hay ninguna fila con ruta local (comprobado antes de borrarla), asi
     * que no hay nada legitimo que servir desde el disco.
     */
    if (!this.esClaveDeVideoValida(key)) {
      this.logger.error(
        `Video ${videoId} con una ubicación que no es del almacenamiento de videos: ${video.videoUrl}`,
      );
      throw new NotFoundException(
        'No pudimos encontrar ese video. Puede que se haya eliminado.',
      );
    }

    try {
      const stream = await this.s3Service.getFileStream(key);
      const filename = key.split('/').pop() || 'video.webm';
      return { stream, filename };
    } catch (error) {
      this.logger.error(
        `Failed to download video from S3 (key: ${key}): ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new NotFoundException(
        'No pudimos descargar el video en este momento. Intenta nuevamente en unos minutos.',
      );
    }
  }

  /**
   * Una clave de video valida es la de NUESTRA carpeta de videos y nada mas.
   *
   * Se comprueba con una lista blanca y no buscando '..', porque las listas de
   * lo prohibido siempre se quedan cortas: '..' se puede escribir codificado,
   * con barras invertidas o con rutas absolutas.
   */
  private esClaveDeVideoValida(key: string): boolean {
    if (!key || typeof key !== 'string') return false;

    return /^videos\/[A-Za-z0-9._\-/]+$/.test(key) && !key.includes('..');
  }
}
