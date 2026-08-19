import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/password.validator';

export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty({ message: 'El enlace de invitación no es válido' })
  token: string;

  @IsString()
  @IsStrongPassword()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password: string;
}
