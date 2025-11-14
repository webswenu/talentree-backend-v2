import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ReportStatus } from '../../../common/enums/report-status.enum';

export class ApproveReportDto {
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
