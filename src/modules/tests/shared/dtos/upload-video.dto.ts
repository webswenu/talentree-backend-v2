import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
} from 'class-validator';

export class UploadVideoDto {
  @IsUUID()
  @IsNotEmpty()
  workerId: string;

  @IsUUID()
  @IsNotEmpty()
  processId: string;

  @IsOptional()
  @IsUUID()
  workerProcessId?: string;

  @IsUrl()
  @IsNotEmpty()
  videoUrl: string;

  @IsOptional()
  @IsNumber()
  videoDuration?: number;

  @IsOptional()
  @IsNumber()
  videoSize?: number;

  @IsOptional()
  @IsObject()
  deviceInfo?: Record<string, any>;
}

export class ReviewVideoDto {
  @IsNotEmpty()
  @IsString()
  status: 'approved' | 'rejected' | 'resubmission_required';

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
