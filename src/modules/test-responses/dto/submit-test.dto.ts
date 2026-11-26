import { IsArray, IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SubmitAnswerDto } from './submit-answer.dto';

export class SubmitTestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers: SubmitAnswerDto[];

  /**
   * `true` cuando el envío lo hizo el temporizador del navegador al acabarse
   * el tiempo; `false` cuando la persona pulsó «Finalizar». Los navegadores
   * con una versión anterior del front no lo mandan: ahí decide solo el reloj
   * del servidor.
   */
  @IsOptional()
  @IsBoolean({ message: 'cierreAutomatico debe ser verdadero o falso' })
  cierreAutomatico?: boolean;
}
