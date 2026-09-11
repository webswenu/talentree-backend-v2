import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Validacion de telefono (hallazgos R-04 y R-10).
 *
 * La regla vivia en UN solo endpoint —el registro publico— y en ninguno de los
 * otros cuatro que escriben el mismo dato. El candidato al que se le exigia
 * +56912345678 para entrar podia dejarlo en 'no tengo' al dia siguiente desde
 * su perfil.
 *
 * Ademas la regla anterior comparaba el valor SIN espacios pero recibia el
 * valor CON espacios, asi que '+56 9 1234 5678' —como se escribe un telefono
 * de verdad— pasaba el navegador y moria en el servidor.
 *
 * Ahora: prefijo internacional obligatorio y de 8 a 15 digitos, que es el
 * maximo de E.164. Los separadores que la gente escribe (espacios, guiones,
 * parentesis, puntos) se aceptan y se quitan antes de guardar, de modo que en
 * base siempre hay una sola forma: '+' seguido de digitos.
 */

/** Minimo y maximo de digitos DESPUES del prefijo. 15 es el tope de E.164. */
export const DIGITOS_MIN_TELEFONO = 8;
export const DIGITOS_MAX_TELEFONO = 15;

const SEPARADORES = /[\s().\-‐-―]/g;

/**
 * Deja el telefono en su forma canonica: '+' y digitos, sin separadores.
 * Acepta '00' como prefijo internacional (Europa y buena parte de Asia) y lo
 * traduce a '+', que es la forma que se guarda.
 */
export function normalizeTelefono(valor: string): string {
  const sinSeparadores = valor.trim().replace(SEPARADORES, '');
  return sinSeparadores.replace(/^00/, '+');
}

export function esTelefonoValido(valor: unknown): boolean {
  if (typeof valor !== 'string') return false;

  const canonico = normalizeTelefono(valor);
  if (!canonico.startsWith('+')) return false;

  const digitos = canonico.slice(1);
  if (!/^[0-9]+$/.test(digitos)) return false;

  return (
    digitos.length >= DIGITOS_MIN_TELEFONO &&
    digitos.length <= DIGITOS_MAX_TELEFONO
  );
}

@ValidatorConstraint({ name: 'esTelefonoValido', async: false })
class TelefonoValidoConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return esTelefonoValido(value);
  }

  defaultMessage(): string {
    // El mensaje dice QUE falta, no solo que el formato es invalido: el error
    // anterior ('Formato de teléfono inválido') no le decia a nadie que lo que
    // faltaba era el prefijo del pais.
    return `El teléfono debe incluir el prefijo del país y entre ${DIGITOS_MIN_TELEFONO} y ${DIGITOS_MAX_TELEFONO} dígitos. Por ejemplo: +56 9 1234 5678.`;
  }
}

export function IsTelefono(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: TelefonoValidoConstraint,
    });
  };
}

/**
 * Normaliza ANTES de validar y de guardar. Va siempre junto a @IsTelefono().
 *
 * Devuelve undefined cuando el campo llega vacio, para que @IsOptional() lo
 * trate como ausente: esa es la causa de R-01, donde 'Teléfono (opcional)'
 * impedia registrarse.
 */
export const NormalizeTelefono = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const canonico = normalizeTelefono(value);
    return canonico === '' ? undefined : canonico;
  });
