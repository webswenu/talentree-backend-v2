import { IsString, IsOptional, IsUUID, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Convierte cadenas vacías en undefined.
 * class-validator omite la validación de un campo opcional solo cuando vale
 * null o undefined: una cadena vacía sí se valida y hace fallar reglas como
 * @IsUUID(), devolviendo un 400 que el usuario no puede interpretar.
 */
const EmptyToUndefined = () =>
  Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  );

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la empresa es obligatorio' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'El RUT es obligatorio' })
  rut: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  logo?: string;

  @IsUUID('4', { message: 'El usuario representante seleccionado no es válido' })
  @IsOptional()
  @EmptyToUndefined()
  userId?: string;
}
