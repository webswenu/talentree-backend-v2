import { IsString, MinLength, IsNotEmpty } from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty({ message: 'La nueva contraseña es requerida' })
  @IsString()
  @MinLength(8, {
    message: 'La nueva contraseña debe tener al menos 8 caracteres',
  })
  newPassword: string;
}
