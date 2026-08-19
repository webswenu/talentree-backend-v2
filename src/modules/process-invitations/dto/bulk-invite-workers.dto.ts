import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * P-38. Antes `email` llevaba @IsEmail() aqui.
 *
 * El problema: el ValidationPipe global valida el cuerpo COMPLETO antes de que
 * el servicio se ejecute. Una sola fila con el correo mal escrito hacia fallar
 * la peticion entera con un 400, y las otras 199 filas correctas de la planilla
 * no se procesaban. Peor aun, el error identificaba la fila por su indice en el
 * arreglo ('invitees.0.email'), que no le dice nada a quien mira su Excel.
 *
 * El formato del correo se valida ahora DENTRO del servicio, fila por fila, y
 * las que estan mal caen en el arreglo `failed` junto a las que fallan por
 * reglas de negocio (ya invitado, ya postulo, sin cupo), identificadas por su
 * numero de fila y por el correo tal como venia escrito.
 */
export class InviteeDto {
  @IsString({ message: 'El email es obligatorio' })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  email: string;

  @IsString({ message: 'El nombre es obligatorio' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  firstName: string;

  @IsString({ message: 'El apellido es obligatorio' })
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  lastName: string;
}

export class BulkInviteWorkersDto {
  @IsUUID('4', { message: 'El proceso seleccionado no es válido' })
  @IsNotEmpty({ message: 'Debes indicar a que proceso invitar' })
  processId: string;

  @IsArray({ message: 'No se recibio ninguna lista de invitados' })
  @ValidateNested({ each: true })
  @Type(() => InviteeDto)
  invitees: InviteeDto[];
}
