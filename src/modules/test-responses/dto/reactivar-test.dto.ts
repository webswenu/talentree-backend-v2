import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * El admin reabre un test que se cerró incompleto (por ejemplo, porque se le
 * acabó el tiempo al postulante) y, si quiere, le avisa por correo.
 */
export class ReactivarTestDto {
  @IsOptional()
  @IsBoolean({ message: 'enviarCorreo debe ser verdadero o falso' })
  enviarCorreo?: boolean;

  @IsOptional()
  @IsString({ message: 'El mensaje debe ser texto' })
  @MaxLength(2000, { message: 'El mensaje no puede superar los 2000 caracteres' })
  mensaje?: string;
}
