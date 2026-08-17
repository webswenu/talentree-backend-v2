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
import { EsPosteriorA } from '../../../common/validators/date-range.validator';

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

  // P-25: este DTO no expone startDate, asi que el decorador no tiene con que
  // comparar y queda como red de seguridad por si se agrega mas adelante.
  // La comprobacion real de la edicion vive en processes.service.update(),
  // que contrasta contra la fecha de inicio ya guardada.
  @IsDateString()
  @IsOptional()
  @EsPosteriorA('startDate')
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
