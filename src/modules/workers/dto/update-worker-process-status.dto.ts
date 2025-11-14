import { IsEnum, IsOptional, IsString, IsInt } from 'class-validator';
import { WorkerStatus } from '../../../common/enums/worker-status.enum';

export class UpdateWorkerProcessStatusDto {
  @IsEnum(WorkerStatus)
  status: WorkerStatus;

  @IsOptional()
  @IsInt()
  totalScore?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
