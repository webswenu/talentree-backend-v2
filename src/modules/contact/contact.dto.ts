import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendContactFormDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El teléfono es requerido' })
  @MaxLength(20, { message: 'El teléfono no puede exceder 20 caracteres' })
  telefono: string;

  @IsEmail({}, { message: 'El correo debe ser válido' })
  @IsNotEmpty({ message: 'El correo es requerido' })
  correo: string;

  @IsString()
  @IsNotEmpty({ message: 'El asunto es requerido' })
  @MaxLength(500, { message: 'El asunto no puede exceder 500 caracteres' })
  asunto: string;
}
