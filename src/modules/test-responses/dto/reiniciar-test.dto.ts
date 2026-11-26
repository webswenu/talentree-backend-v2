import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * El admin reinicia UN test de una persona dentro de un proceso: se borran
 * sus respuestas y la persona lo rinde de nuevo desde cero. Los demás tests
 * de la postulación no se tocan.
 */
export class ReiniciarTestDto {
  /** Queda en la auditoría junto con el respaldo del intento anterior. */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'El motivo debe ser texto' })
  @IsNotEmpty({ message: 'Indica el motivo del reinicio' })
  @MinLength(3, { message: 'El motivo debe tener al menos 3 caracteres' })
  @MaxLength(1000, { message: 'El motivo no puede superar los 1000 caracteres' })
  motivo: string;

  @IsOptional()
  @IsBoolean({ message: 'enviarCorreo debe ser verdadero o falso' })
  enviarCorreo?: boolean;

  @IsOptional()
  @IsString({ message: 'El mensaje debe ser texto' })
  @MaxLength(2000, { message: 'El mensaje no puede superar los 2000 caracteres' })
  mensaje?: string;
}
