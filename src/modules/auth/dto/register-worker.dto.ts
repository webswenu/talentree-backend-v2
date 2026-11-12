import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { IsRut, NormalizeRut } from '../../../common/validators/rut.validator';
import { IsStrongPassword } from '../../../common/validators/password.validator';
import {
  IsTelefono,
  NormalizeTelefono,
} from '../../../common/validators/telefono.validator';
import { VacioComoAusente } from '../../../common/validators/opcional.validator';

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

  // R-01 / R-04 / R-10. Antes: un @Matches propio de este DTO que (a) fallaba
  // con la cadena vacia, aunque el campo se rotula «opcional» en pantalla, y
  // (b) rechazaba los espacios que el propio formulario dejaba escribir.
  @IsOptional()
  @NormalizeTelefono()
  @IsTelefono()
  phone?: string;

  // R-02. Mismo caso que el telefono: el paso 3 se titula «Datos opcionales»
  // y la fecha en blanco impedia registrarse.
  @IsOptional()
  @VacioComoAusente()
  @IsDateString({}, { message: 'Fecha de nacimiento inválida' })
  birthDate?: string;

  @IsOptional()
  @VacioComoAusente()
  @IsString()
  address?: string;

  @IsOptional()
  @VacioComoAusente()
  @IsString()
  city?: string;

  @IsOptional()
  @VacioComoAusente()
  @IsString()
  region?: string;

  @IsOptional()
  @VacioComoAusente()
  @IsString()
  education?: string;

  @IsOptional()
  @VacioComoAusente()
  @IsString()
  experience?: string;
}
