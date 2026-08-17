import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/password.validator';

export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty({ message: 'El enlace de invitacion no es valido' })
  token: string;

  @IsString()
  @IsStrongPassword()
  @IsNotEmpty({ message: 'La contrasena es obligatoria' })
  password: string;
}
