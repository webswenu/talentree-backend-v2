import {
  IsString,
  IsEmail,
  MinLength,
  IsOptional,
  IsDateString,
  Matches,
} from 'class-validator';
import { IsRut, NormalizeRut } from '../../../common/validators/rut.validator';
import { IsStrongPassword } from '../../../common/validators/password.validator';

export class RegisterWorkerDto {
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  // P-52. Antes la unica regla era el largo minimo de 6, asi que '12345678'
  // pasaba sin problema.
  @IsString()
  @IsStrongPassword()
  password: string;

  @IsString({ message: 'El nombre es requerido' })
  firstName: string;

  @IsString({ message: 'El apellido es requerido' })
  lastName: string;

  // P-51. Antes: @Matches sin dígito verificador y exigiendo el RUT sin puntos.
  // Aceptaba 12345678-0 (DV incorrecto) y rechazaba 12.345.678-5 (DV correcto).
  @IsString({ message: 'El RUT es requerido' })
  @IsRut()
  @NormalizeRut()
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
