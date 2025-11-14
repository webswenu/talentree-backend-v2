import { Injectable, InternalServerErrorException } from '@nestjs/common';
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
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new InternalServerErrorException(
        'AWS S3 credentials are not configured properly',
      );
    }

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.bucketName =
      this.configService.get<string>('AWS_S3_BUCKET') || 'talentree-bucket';
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
    try {
      const params: PutObjectCommandInput = {
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        Metadata: metadata,
      };

      const command = new PutObjectCommand(params);
      await this.s3Client.send(command);

      // Return the public URL
      return `https://${this.bucketName}.s3.${this.configService.get('AWS_REGION')}.amazonaws.com/${key}`;
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to upload file to S3: ${error instanceof Error ? error.message : String(error)}`,
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
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to generate signed URL: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Delete a file from S3
   * @param key - S3 object key
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to delete file from S3: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Check if a file exists in S3
   * @param key - S3 object key
   * @returns true if file exists, false otherwise
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw new InternalServerErrorException(
        `Failed to check file existence: ${error instanceof Error ? error.message : String(error)}`,
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
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return {
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        contentType: response.ContentType || 'application/octet-stream',
        metadata: response.Metadata,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to get file info: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Download file buffer from S3
   * @param key - S3 object key
   * @returns File buffer
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

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
      throw new InternalServerErrorException(
        `Failed to download file from S3: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get file stream from S3
   * @param key - S3 object key
   * @returns Readable stream
   */
  async getFileStream(key: string): Promise<any> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new InternalServerErrorException('File body is empty');
      }

      return response.Body;
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to get file stream from S3: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
