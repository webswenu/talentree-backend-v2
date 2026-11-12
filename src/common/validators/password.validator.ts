import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Politica de contrasena (hallazgo P-52).
 *
 * La unica regla era un largo minimo de 6, asi que '12345678' —ocho digitos
 * consecutivos, sin letras ni simbolos— se aceptaba sin problema. El proyecto
 * ya tenia una funcion isStrongPassword en el frontend (utils/validators.ts),
 * pero vivia solo ahi: la validacion del navegador no protege nada, porque la
 * API se puede llamar directamente.
 *
 * La regla vale donde importa, que es el backend.
 *
 * D-3 (decidido): se exige ademas al menos una mayuscula. Si mas adelante se
 * quiere un simbolo, o subir el minimo a 10, se cambia aqui y aplica a todo
 * el sistema, incluido el formulario, que deriva su texto de ayuda de esta
 * misma regla.
 */

/** Largo minimo. Antes eran 6. */
export const LARGO_MINIMO_PASSWORD = 8;

/**
 * Las contrasenas mas usadas del mundo, que un atacante prueba primero.
 * Lista corta a proposito: cubre el grueso sin volverse una dependencia.
 */
const PASSWORDS_COMUNES = new Set([
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password1',
  'contrasena',
  'qwertyui',
  'qwerty123',
  'abc12345',
  'talentree',
  'admin123',
  'iloveyou',
]);

export function esPasswordFuerte(value: unknown): true | string {
  if (typeof value !== 'string') {
    return 'La contraseña es obligatoria.';
  }

  if (value.length < LARGO_MINIMO_PASSWORD) {
    return `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`;
  }

  if (!/[a-zA-Z]/.test(value)) {
    return 'La contraseña debe incluir al menos una letra.';
  }

  // D-3: decidido con la clienta. El frontend ya exigia mayuscula en una regla
  // que no usaba nadie; ahora la regla vale y vale en los dos lados.
  // No invalida cuentas existentes: el login compara el hash, no la politica.
  if (!/[A-ZÁÉÍÓÚÑÜ]/.test(value)) {
    return 'La contraseña debe incluir al menos una letra mayúscula.';
  }

  if (!/[0-9]/.test(value)) {
    return 'La contraseña debe incluir al menos un número.';
  }

  if (PASSWORDS_COMUNES.has(value.toLowerCase())) {
    return 'Esa contraseña es demasiado común. Elige otra.';
  }

  return true;
}

@ValidatorConstraint({ name: 'esPasswordFuerte', async: false })
class PasswordFuerteConstraint implements ValidatorConstraintInterface {
  private ultimoMotivo = 'La contraseña no cumple los requisitos mínimos.';

  validate(value: unknown): boolean {
    const resultado = esPasswordFuerte(value);
    if (resultado === true) return true;
    this.ultimoMotivo = resultado;
    return false;
  }

  defaultMessage(): string {
    // Se devuelve el motivo concreto y no un texto generico: si el usuario no
    // sabe QUE le falta, prueba al azar.
    return this.ultimoMotivo;
  }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: PasswordFuerteConstraint,
    });
  };
}
