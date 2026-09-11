import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsArray,
} from 'class-validator';
import { IsRut, NormalizeRut } from '../../../common/validators/rut.validator';
import { IsStrongPassword } from '../../../common/validators/password.validator';
import {
  IsTelefono,
  NormalizeTelefono,
} from '../../../common/validators/telefono.validator';
import { VacioComoAusente } from '../../../common/validators/opcional.validator';

export class CreateWorkerDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  // P-51 / ADM-TRA-04: el alta desde el panel no validaba el RUT en absoluto.
  @IsString({ message: 'El RUT es obligatorio' })
  @IsRut()
  @NormalizeRut()
  rut: string;

  @IsEmail()
  email: string;

  /**
   * Obligatoria a proposito.
   *
   * Era opcional, y cuando no venia el servicio asignaba una contrasena fija
   * escrita en el codigo, en un repositorio PUBLICO. El panel siempre manda
   * una, asi que ese respaldo solo se disparaba en llamadas directas a la API;
   * las cuentas que creara quedaban con una clave que puede leer cualquiera en
   * GitHub. Vale mas fallar y decir que falta.
   */
  @IsNotEmpty({
    message:
      'La contraseña es obligatoria para crear un candidato. Elige una y comunícasela a la persona.',
  })
  @IsString()
  @IsStrongPassword()
  password: string;

  // R-10. El alta desde el panel aceptaba cualquier texto como telefono,
  // mientras el registro publico exigia formato. Misma regla en los dos.
  @IsOptional()
  @NormalizeTelefono()
  @IsTelefono()
  phone?: string;

  @IsOptional()
  @VacioComoAusente()
  @IsDateString()
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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsString()
  cvUrl?: string;
}
