import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);

  private s3Client: S3Client | null = null;
  private bucketName: string;
  private endpoint?: string;

  /** Qué faltó configurar, para poder decirlo cuando alguien intente usarlo. */
  private readonly faltantes: string[] = [];

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    if (!region) this.faltantes.push('AWS_REGION');
    if (!accessKeyId) this.faltantes.push('AWS_ACCESS_KEY_ID');
    if (!secretAccessKey) this.faltantes.push('AWS_SECRET_ACCESS_KEY');

    this.bucketName =
      this.configService.get<string>('AWS_S3_BUCKET') || 'talentree-bucket';

    // P-20. Antes esto era un `throw` en el constructor. Como S3Service es un
    // proveedor que media plataforma inyecta, la excepción se disparaba al
    // construir el contenedor de dependencias y el backend COMPLETO no
    // arrancaba: sin credenciales de AWS no había login, ni procesos, ni
    // candidatos, ni nada. Una funcionalidad opcional tumbaba el producto
    // entero.
    //
    // Ahora el arranque no depende de esto. El servicio queda marcado como no
    // configurado y solo falla quien de verdad necesite un archivo, con un
    // mensaje que dice exactamente qué variable falta.
    if (this.faltantes.length > 0) {
      this.logger.warn(
        `Almacenamiento de archivos DESACTIVADO: faltan ${this.faltantes.join(', ')}. ` +
          'El resto de la plataforma funciona con normalidad; las subidas y ' +
          'descargas de archivos responderán con un error explícito.',
      );
      return;
    }

    // Endpoint alternativo compatible con S3 (MinIO en desarrollo, por ejemplo).
    // Si no se define, se usa el S3 real de AWS.
    this.endpoint = this.configService.get<string>('AWS_S3_ENDPOINT');

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      ...(this.endpoint
        ? { endpoint: this.endpoint, forcePathStyle: true }
        : {}),
    });
  }

  /** Permite a otros módulos preguntar antes de ofrecer una acción. */
  get estaConfigurado(): boolean {
    return this.s3Client !== null;
  }

  /**
   * Devuelve el cliente o corta con un error que se entiende.
   * Todas las operaciones pasan por aquí.
   */
  private get cliente(): S3Client {
    if (!this.s3Client) {
      throw new ServiceUnavailableException(
        `El almacenamiento de archivos no está configurado en este servidor (falta ${this.faltantes.join(', ')}). ` +
          'Los documentos, logos y videos no están disponibles hasta que se configure.',
      );
    }
    return this.s3Client;
  }

  /**
   * URL publica de un objeto. Con endpoint propio se usa path-style
   * (http://host/bucket/key); con AWS, el virtual-hosted habitual.
   */
  private buildPublicUrl(key: string): string {
    if (this.endpoint) {
      return `${this.endpoint.replace(/\/+$/, '')}/${this.bucketName}/${key}`;
    }
    return `https://${this.bucketName}.s3.${this.configService.get('AWS_REGION')}.amazonaws.com/${key}`;
  }

  /**
   * Generate a unique file key for S3
   * @param originalFileName - Original file name
   * @param folder - Folder path in S3 (e.g., 'reports', 'logos')
   * @param clientId - Optional client/company ID for namespacing
   */
  generateFileKey(
    originalFileName: string,
    folder: string,
    clientId?: string,
  ): string {
    const timestamp = Date.now();
    const uuid = uuidv4();
    const extension = originalFileName.split('.').pop();
    const sanitizedFolder = folder.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes

    if (clientId) {
      return `${sanitizedFolder}/${clientId}/${timestamp}-${uuid}.${extension}`;
    }

    return `${sanitizedFolder}/${timestamp}-${uuid}.${extension}`;
  }

  /**
   * Upload a file to S3
   * @param fileBuffer - File buffer
   * @param key - S3 object key (path)
   * @param contentType - MIME type of the file
   * @param metadata - Optional metadata
   * @returns The public URL of the uploaded file
   */
  async uploadFile(
    fileBuffer: Buffer,
    key: string,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    const cliente = this.cliente; // fuera del try: su 503 no debe volverse 500
    try {
      const params: PutObjectCommandInput = {
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        Metadata: metadata,
      };

      const command = new PutObjectCommand(params);
      await cliente.send(command);

      // Return the public URL
      return this.buildPublicUrl(key);
    } catch (error) {
      // El detalle del proveedor queda en el log; al usuario le llega un texto
      // que puede entender y accionar.
      this.logger.error(
        `S3: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new InternalServerErrorException(
        'No pudimos guardar el archivo. Intenta nuevamente en unos minutos.',
      );
    }
  }

  /**
   * Generate a pre-signed URL for temporary access to a file
   * @param key - S3 object key
   * @param expiresInSeconds - URL expiration time in seconds (default: 1 hour)
   * @returns Pre-signed URL
   */
  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const cliente = this.cliente;
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(cliente, command, {
        expiresIn: expiresInSeconds,
      });
    } catch (error) {
      // El detalle del proveedor queda en el log; al usuario le llega un texto
      // que puede entender y accionar.
      this.logger.error(
        `S3: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new InternalServerErrorException(
        'No pudimos preparar el enlace de descarga. Intenta nuevamente.',
      );
    }
  }

  /**
   * Delete a file from S3
   * @param key - S3 object key
   */
  async deleteFile(key: string): Promise<void> {
    const cliente = this.cliente;
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await cliente.send(command);
    } catch (error) {
      // El detalle del proveedor queda en el log; al usuario le llega un texto
      // que puede entender y accionar.
      this.logger.error(
        `S3: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new InternalServerErrorException(
        'No pudimos eliminar el archivo. Intenta nuevamente.',
      );
    }
  }

  /**
   * Check if a file exists in S3
   * @param key - S3 object key
   * @returns true if file exists, false otherwise
   */
  async fileExists(key: string): Promise<boolean> {
    const cliente = this.cliente;
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await cliente.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw new InternalServerErrorException(
        'No pudimos verificar el archivo. Intenta nuevamente.',
      );
    }
  }

  /**
   * Get file metadata from S3
   * @param key - S3 object key
   * @returns File metadata
   */
  async getFileInfo(key: string): Promise<{
    size: number;
    lastModified: Date;
    contentType: string;
    metadata?: Record<string, string>;
  }> {
    const cliente = this.cliente;
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await cliente.send(command);

      return {
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        contentType: response.ContentType || 'application/octet-stream',
        metadata: response.Metadata,
      };
    } catch (error) {
      // El detalle del proveedor queda en el log; al usuario le llega un texto
      // que puede entender y accionar.
      this.logger.error(
        `S3: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new InternalServerErrorException(
        'No pudimos leer los datos del archivo. Intenta nuevamente.',
      );
    }
  }

  /**
   * Download file buffer from S3
   * @param key - S3 object key
   * @returns File buffer
   */
  async downloadFile(key: string): Promise<Buffer> {
    const cliente = this.cliente;
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await cliente.send(command);

      if (!response.Body) {
        throw new InternalServerErrorException('File body is empty');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      // El detalle del proveedor queda en el log; al usuario le llega un texto
      // que puede entender y accionar.
      this.logger.error(
        `S3: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new InternalServerErrorException(
        'No pudimos descargar el archivo. Intenta nuevamente en unos minutos.',
      );
    }
  }

  /**
   * Get file stream from S3
   * @param key - S3 object key
   * @returns Readable stream
   */
  async getFileStream(key: string): Promise<any> {
    const cliente = this.cliente;
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await cliente.send(command);

      if (!response.Body) {
        throw new InternalServerErrorException('File body is empty');
      }

      return response.Body;
    } catch (error) {
      // El detalle del proveedor queda en el log; al usuario le llega un texto
      // que puede entender y accionar.
      this.logger.error(
        `S3: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new InternalServerErrorException(
        'No pudimos abrir el archivo. Intenta nuevamente en unos minutos.',
      );
    }
  }
}
