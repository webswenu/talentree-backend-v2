import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class UpdateCompanyDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  rut?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsString()
  @IsOptional()
  description?: string;

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

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsDateString()
  @IsOptional()
  contractEndDate?: Date;

  /**
   * Representante de la empresa.
   *
   *  - ausente  -> no se toca
   *  - null     -> se desvincula al representante actual
   *  - uuid     -> se asigna ese usuario
   *
   * El null explicito es lo que permite LIBERAR a un usuario para que pueda
   * representar a otra empresa. Sin el no habia forma de deshacer una
   * asignacion, porque `if (userId)` trata null y ausente igual.
   */
  @IsUUID('4', {
    message: 'El usuario representante seleccionado no es valido',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  userId?: string | null;
}
