import {
  IsString,
  IsEmail,
  MinLength,
  IsOptional,
  IsDateString,
  Matches,
} from 'class-validator';

export class RegisterWorkerDto {
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @IsString({ message: 'El nombre es requerido' })
  firstName: string;

  @IsString({ message: 'El apellido es requerido' })
  lastName: string;

  @IsString({ message: 'El RUT es requerido' })
  @Matches(/^[0-9]{7,8}-[0-9Kk]{1}$/, {
    message: 'Formato de RUT inválido (ej: 12345678-9)',
  })
  rut: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/, {
    message: 'Formato de teléfono inválido',
  })
  phone?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Fecha de nacimiento inválida' })
  birthDate?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  education?: string;

  @IsOptional()
  @IsString()
  experience?: string;
}
