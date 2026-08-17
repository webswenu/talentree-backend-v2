import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';
import { ProcessStatus } from '../../../common/enums/process-status.enum';
import { EsPosteriorA } from '../../../common/validators/date-range.validator';

export class CreateProcessDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  position: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsEnum(ProcessStatus)
  status: ProcessStatus;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  // P-25: sin esto se creaba un proceso que terminaba antes de empezar.
  @IsDateString()
  @IsOptional()
  @EsPosteriorA('startDate')
  endDate?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxWorkers?: number;

  @IsUUID()
  companyId: string;
}
