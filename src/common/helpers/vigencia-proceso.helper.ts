/**
 * Vigencia de un proceso según su fecha de término.
 *
 * La fecha de término es un día calendario de Chile y el proceso sigue abierto
 * DURANTE ese día. Antes se comparaba la fecha contra `new Date()` y la
 * columna `date` se leía como la medianoche UTC de ese día: el cierre
 * automático de las 03:00 UTC (medianoche en Chile) cerraba los procesos al
 * COMIENZO de su último día. Le pasó a «Asistente Administrativo» el
 * 20-11-2026, con una candidata a medio rendir.
 */

const ZONA_CHILE = 'America/Santiago';

/** Hoy en Chile, como 'YYYY-MM-DD'. */
export function hoyEnChile(ahora: Date = new Date()): string {
  // en-CA da el formato ISO (2026-11-20).
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_CHILE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

/**
 * La fecha como 'YYYY-MM-DD', o null si no hay fecha válida. TypeORM entrega
 * las columnas `date` como texto, pero el tipo de la entidad dice `Date`, así
 * que se aceptan las dos formas.
 */
export function fechaComoDia(fecha: unknown): string | null {
  if (!fecha) return null;
  if (fecha instanceof Date) {
    return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString().slice(0, 10);
  }
  const texto = String(fecha).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : null;
}

/** El proceso ya pasó su último día (en Chile). Sin fecha, nunca vence. */
export function procesoVencido(fechaTermino: unknown, ahora: Date = new Date()): boolean {
  const dia = fechaComoDia(fechaTermino);
  return dia !== null && dia < hoyEnChile(ahora);
}
