import { IsOptional, IsString, IsEnum, IsBooleanString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { UserRole } from '../../../common/enums/user-role.enum';

/**
 * P-69. El listado de usuarios era el único del panel que no aceptaba filtros:
 * descargaba TODOS los usuarios con sus relaciones y el navegador filtraba en
 * memoria. Con pocos usuarios no se nota; con varios miles, la pantalla
 * descarga una nómina completa (con correos y datos de empresa) para mostrar
 * diez filas.
 *
 * Este DTO alinea el endpoint con el patrón que ya usan empresas, procesos y
 * trabajadores.
 */
export class UserFilterDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'El rol indicado no es válido' })
  role?: UserRole;

  @IsOptional()
  @IsBooleanString({ message: 'El estado activo debe ser true o false' })
  isActive?: string;
}
