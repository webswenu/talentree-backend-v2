import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { isValidRut, normalizeRut } from '../helpers/rut.helper';

/**
 * Validacion de RUT chileno para los DTO (hallazgo P-51).
 *
 * El alta de EMPRESAS ya validaba el digito verificador y normalizaba el
 * formato, pero esa correccion nunca se propago: el registro publico de
 * trabajadores seguia con un @Matches que (a) no comprobaba el digito
 * verificador, asi que aceptaba 12345678-0 cuando el correcto es -5, y
 * (b) exigia el RUT SIN puntos, que es justo como NO se escribe en Chile.
 *
 * Aqui queda como una sola pieza reutilizable, para no tener que volver a
 * propagarla a mano la proxima vez.
 */

@ValidatorConstraint({ name: 'esRutValido', async: false })
class EsRutValidoConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || value.trim() === '') return false;
    return isValidRut(value);
  }

  defaultMessage(): string {
    return 'El RUT ingresado no es valido. Verifique el numero y el digito verificador.';
  }
}

/**
 * Acepta el RUT en cualquier formato de escritura habitual
 * (12.345.678-9, 12345678-9, 123456789) y verifica el digito verificador.
 */
export function IsRut(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: EsRutValidoConstraint,
    });
  };
}

/**
 * Normaliza el RUT ANTES de validar y de guardar, para que la comparacion de
 * duplicados no dependa de como lo escribio el usuario. Va siempre junto a
 * @IsRut() y por debajo de el en el orden de decoradores.
 */
export const NormalizeRut = () =>
  Transform(({ value }) =>
    typeof value === 'string' && value.trim() !== ''
      ? normalizeRut(value)
      : value,
  );
