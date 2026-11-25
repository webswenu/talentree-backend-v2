import { Transform } from 'class-transformer';
import { FindOperator, Raw } from 'typeorm';

/**
 * Un correo es la identidad de inicio de sesion, asi que tiene que compararse
 * igual sin importar como lo escriba la persona.
 *
 * Caso real (24-11-2026): un trabajador se registro desde el celular con
 * "Juanperez@91gmail.com" (el teclado le puso mayuscula) y despues no pudo
 * volver a entrar: el login buscaba el correo exacto, mayusculas incluidas.
 */
export function normalizarEmail(valor: unknown): string {
  return String(valor ?? '')
    .trim()
    .toLowerCase();
}

/** Decorador para DTOs: deja el correo sin espacios y en minusculas. */
export function NormalizeEmail(): PropertyDecorator {
  return Transform(({ value }) =>
    typeof value === 'string' ? normalizarEmail(value) : value,
  );
}

/**
 * Condicion de busqueda por correo sin distinguir mayusculas. Sirve para las
 * cuentas antiguas que quedaron guardadas con mayusculas.
 */
export function emailIgual(email: string): FindOperator<string> {
  return Raw((columna) => `LOWER(${columna}) = :emailNormalizado`, {
    emailNormalizado: normalizarEmail(email),
  });
}

/**
 * "juanperez91@gmail.com" -> "jua•••@gmail.com".
 *
 * Se muestra cuando alguien intenta registrarse con un RUT que ya tiene
 * cuenta: le permite reconocer con que correo se registro (y darse cuenta de
 * un error de tipeo en el dominio) sin exponer la direccion completa.
 */
export function enmascararEmail(email: string): string {
  const [local, dominio] = String(email ?? '').split('@');
  if (!dominio) return '•••';
  const visible = local.slice(0, Math.min(3, Math.max(1, local.length - 1)));
  return `${visible}•••@${dominio}`;
}
