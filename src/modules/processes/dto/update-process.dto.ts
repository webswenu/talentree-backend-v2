import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  IsArray,
  IsUUID,
} from 'class-validator';
import { ProcessStatus } from '../../../common/enums/process-status.enum';

export class UpdateProcessDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsEnum(ProcessStatus)
  @IsOptional()
  status?: ProcessStatus;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxWorkers?: number;
}

export class AssignEvaluatorsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  evaluatorIds: string[];
}
