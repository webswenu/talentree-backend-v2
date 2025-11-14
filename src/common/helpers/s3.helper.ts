import { InternalServerErrorException } from '@nestjs/common';
import { S3Service } from '../services/s3.service';

export interface S3UploadResult {
  key: string;
  url: string;
  bucket: string;
}

export interface S3FileDetails {
  key: string;
  url: string;
  signedUrl: string;
}

/**
 * Upload a file to S3 and get the public URL
 * @param s3Service - S3 service instance
 * @param file - Multer file object
 * @param folder - Folder path in S3 (e.g., 'reports', 'logos')
 * @param clientId - Optional client/company ID for namespacing
 * @returns Upload result with key, URL, and bucket
 */
export async function uploadFileAndGetPublicUrl(
  s3Service: S3Service,
  file: Express.Multer.File,
  folder: string,
  clientId?: string,
): Promise<S3UploadResult> {
  try {
    const fileKey = s3Service.generateFileKey(
      file.originalname,
      folder,
      clientId,
    );

    const contentType = getContentTypeFromFileName(file.originalname);

    const location = await s3Service.uploadFile(
      file.buffer,
      fileKey,
      contentType,
    );

    return {
      key: fileKey,
      url: location,
      bucket: process.env.AWS_S3_BUCKET || 'talentree-bucket',
    };
  } catch (error) {
    throw new InternalServerErrorException(
      `Upload failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Upload a file to S3 and get full details including signed URL
 * @param s3Service - S3 service instance
 * @param file - Multer file object
 * @param folder - Folder path in S3
 * @param clientId - Optional client/company ID
 * @returns Full file details with public and signed URLs
 */
export async function uploadFileAndGetDetails(
  s3Service: S3Service,
  file: Express.Multer.File,
  folder: string,
  clientId?: string,
): Promise<S3FileDetails> {
  try {
    const fileKey = s3Service.generateFileKey(
      file.originalname,
      folder,
      clientId,
    );

    const contentType = getContentTypeFromFileName(file.originalname);

    const location = await s3Service.uploadFile(
      file.buffer,
      fileKey,
      contentType,
    );

    const signedUrl = await s3Service.getSignedUrl(fileKey, 3600);

    return {
      key: fileKey,
      url: location,
      signedUrl: signedUrl,
    };
  } catch (error) {
    throw new InternalServerErrorException(
      `Upload failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Upload a buffer (e.g., generated PDF) to S3
 * @param s3Service - S3 service instance
 * @param buffer - File buffer
 * @param fileName - Original file name (for extension)
 * @param folder - Folder path in S3
 * @param clientId - Optional client/company ID
 * @returns Upload result with key and URL
 */
export async function uploadBufferToS3(
  s3Service: S3Service,
  buffer: Buffer,
  fileName: string,
  folder: string,
  clientId?: string,
): Promise<S3UploadResult> {
  try {
    const fileKey = s3Service.generateFileKey(fileName, folder, clientId);

    const contentType = getContentTypeFromFileName(fileName);

    const location = await s3Service.uploadFile(buffer, fileKey, contentType);

    return {
      key: fileKey,
      url: location,
      bucket: process.env.AWS_S3_BUCKET || 'talentree-bucket',
    };
  } catch (error) {
    throw new InternalServerErrorException(
      `Buffer upload failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Generate a signed URL for temporary file access
 * @param s3Service - S3 service instance
 * @param fileKey - S3 object key
 * @param expiresInSeconds - URL expiration time (default: 1 hour)
 * @returns Pre-signed URL
 */
export async function generateSignedUrl(
  s3Service: S3Service,
  fileKey: string,
  expiresInSeconds: number = 3600,
): Promise<string> {
  try {
    return await s3Service.getSignedUrl(fileKey, expiresInSeconds);
  } catch (error) {
    throw new InternalServerErrorException(
      `Failed to generate signed URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Delete a file from S3
 * @param s3Service - S3 service instance
 * @param fileKey - S3 object key
 */
export async function deleteFileFromS3(
  s3Service: S3Service,
  fileKey: string,
): Promise<void> {
  try {
    await s3Service.deleteFile(fileKey);
  } catch (error) {
    throw new InternalServerErrorException(
      `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Check if a file exists in S3
 * @param s3Service - S3 service instance
 * @param fileKey - S3 object key
 * @returns true if file exists
 */
export async function fileExistsInS3(
  s3Service: S3Service,
  fileKey: string,
): Promise<boolean> {
  try {
    return await s3Service.fileExists(fileKey);
  } catch (error) {
    return false;
  }
}

/**
 * Get file information from S3
 * @param s3Service - S3 service instance
 * @param fileKey - S3 object key
 * @returns File metadata
 */
export async function getFileInfoFromS3(
  s3Service: S3Service,
  fileKey: string,
): Promise<{
  size: number;
  lastModified: Date;
  contentType: string;
  metadata?: Record<string, string>;
}> {
  try {
    return await s3Service.getFileInfo(fileKey);
  } catch (error) {
    throw new InternalServerErrorException(
      `Failed to get file info: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Get MIME type from file extension
 * @param fileName - File name with extension
 * @returns MIME type string
 */
export function getContentTypeFromFileName(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();

  const contentTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',

    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    // Text
    txt: 'text/plain',
    csv: 'text/csv',
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    xml: 'application/xml',

    // Archives
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',

    // Video
    mp4: 'video/mp4',
    avi: 'video/x-msvideo',
    mov: 'video/quicktime',
    wmv: 'video/x-ms-wmv',
    flv: 'video/x-flv',
    webm: 'video/webm',

    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
  };

  return contentTypes[extension || ''] || 'application/octet-stream';
}

/**
 * Extract S3 key from a full S3 URL or return the key as-is
 * @param urlOrKey - Full S3 URL or S3 key
 * @returns S3 key (e.g., "cvs/worker-id/file.pdf")
 */
export function extractS3KeyFromUrl(urlOrKey: string): string {
  // If it's already a key (starts with folder name), return as-is
  if (!urlOrKey.includes('://')) {
    return urlOrKey;
  }

  // If it's a full URL, extract the key from pathname
  try {
    const url = new URL(urlOrKey);
    // Remove leading slash from pathname
    return url.pathname.substring(1);
  } catch (error) {
    // If URL parsing fails, return as-is
    return urlOrKey;
  }
}

/**
 * Format file size in human-readable format
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
