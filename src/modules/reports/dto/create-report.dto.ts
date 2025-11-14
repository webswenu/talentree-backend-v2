import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { ReportType } from '../../../common/enums/report-type.enum';

export class CreateReportDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ReportType)
  type: ReportType;

  @IsOptional()
  @IsObject()
  content?: Record<string, any>;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsDateString()
  generatedDate?: string;

  @IsOptional()
  @IsUUID()
  processId?: string;

  @IsOptional()
  @IsUUID()
  workerId?: string;
}
