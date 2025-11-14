import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CompanyFilterDto extends PaginationDto {
  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser un valor booleano' })
  @Type(() => Boolean)
  active?: boolean;

  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser un texto' })
  search?: string;
}
