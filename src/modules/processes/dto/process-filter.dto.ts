import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ProcessStatus } from '../../../common/enums/process-status.enum';

export class ProcessFilterDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ProcessStatus, { message: 'El estado debe ser un valor válido' })
  status?: ProcessStatus;

  @IsOptional()
  @IsUUID('4', { message: 'El ID de la empresa debe ser un UUID válido' })
  companyId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del evaluador debe ser un UUID válido' })
  evaluatorId?: string;

  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser un texto' })
  search?: string;
}
