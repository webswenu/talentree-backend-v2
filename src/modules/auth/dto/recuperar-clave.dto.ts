import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { NormalizeEmail } from '../../../common/helpers/email-normalizado.helper';
import { IsStrongPassword } from '../../../common/validators/password.validator';

export class SolicitarRecuperacionDto {
  @NormalizeEmail()
  @IsEmail({}, { message: 'Ingresa un correo válido' })
  email: string;
}

export class RestablecerClaveDto {
  @IsString()
  @IsNotEmpty({ message: 'El enlace no es válido' })
  token: string;

  @IsString()
  @IsStrongPassword()
  password: string;
}
