/**
 * Utilidades de RUT chileno para el backend.
 *
 * El RUT se almacena normalizado (sin puntos, con guión y dígito verificador
 * en mayúscula) para que la comparación de duplicados no dependa de cómo lo
 * haya escrito el usuario: 12.345.678-9 y 12345678-9 son el mismo RUT.
 */

/** Deja solo dígitos y el verificador, sin puntos ni guión. Ej: "123456789" */
export function stripRut(rut: string): string {
  return (rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

/** Normaliza al formato de almacenamiento. Ej: "12345678-9" */
export function normalizeRut(rut: string): string {
  const bare = stripRut(rut);
  if (bare.length < 2) return bare;
  return `${bare.slice(0, -1)}-${bare.slice(-1)}`;
}

/** Valida el dígito verificador (módulo 11). */
export function isValidRut(rut: string): boolean {
  const bare = stripRut(rut);

  if (!/^[0-9]{7,8}[0-9K]$/.test(bare)) {
    return false;
  }

  const body = bare.slice(0, -1);
  const dv = bare.slice(-1);

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const rest = 11 - (sum % 11);
  const expected = rest === 11 ? '0' : rest === 10 ? 'K' : String(rest);

  return expected === dv;
}
