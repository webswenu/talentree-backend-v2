/**
 * Lleva la respuesta de una pregunta de alternativas a la CLAVE de la opción
 * elegida (A, B, C, D).
 *
 * El formulario del candidato envía el TEXTO de la opción y no su clave: arma
 * las opciones con `.map(([, value]) => value)` y descarta la clave. Ese detalle
 * dejó al IL en 0/20 para todos (verificado en producción el 19-08-2026), así
 * que los puntuadores nuevos lo resuelven desde el primer día y aceptan:
 *   "B"               -> la clave directa
 *   "Ocasionalmente"  -> el texto, sin importar mayúsculas, tildes ni espacios
 *   { value: "B" }    -> envuelta en un objeto
 *
 * Devuelve null cuando no se puede resolver. Nunca se adivina: quien llama
 * decide qué hacer con una respuesta que no entiende.
 */
export function resolverClaveDeOpcion(
  respuesta: unknown,
  opciones: Record<string, unknown> | null | undefined,
): string | null {
  if (respuesta === null || respuesta === undefined) return null;
  if (!opciones || typeof opciones !== 'object') return null;

  let valor: unknown = respuesta;
  if (typeof valor === 'object') {
    if (Array.isArray(valor)) return null;
    const envuelta = valor as Record<string, unknown>;
    valor = envuelta.value ?? envuelta.answer ?? envuelta.option ?? null;
  }

  if (typeof valor !== 'string') return null;

  const buscado = normalizarTexto(valor);
  if (!buscado) return null;

  const claves = Object.keys(opciones).filter(
    (clave) => clave !== 'scoring' && clave !== 'format',
  );

  const porClave = claves.find((clave) => normalizarTexto(clave) === buscado);
  if (porClave) return porClave;

  const porTexto = claves.find(
    (clave) =>
      typeof opciones[clave] === 'string' &&
      normalizarTexto(opciones[clave] as string) === buscado,
  );
  return porTexto ?? null;
}

/** Sin tildes, sin espacios de más y en minúsculas. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
