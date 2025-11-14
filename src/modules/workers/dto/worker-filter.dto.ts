import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { WorkerStatus } from '../../../common/enums/worker-status.enum';

export class WorkerFilterDto extends PaginationDto {
  @IsOptional()
  @IsEnum(WorkerStatus, { message: 'El estado debe ser un valor válido' })
  status?: WorkerStatus;

  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser un texto' })
  search?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID de la empresa debe ser un UUID válido' })
  companyId?: string;
}
