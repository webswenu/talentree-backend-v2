import { IsEmail, IsString, MinLength } from 'class-validator';
import { NormalizeEmail } from '../../../common/helpers/email-normalizado.helper';

export class LoginDto {
  @NormalizeEmail()
  @IsEmail({}, { message: 'Ingresa un correo válido' })
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}
