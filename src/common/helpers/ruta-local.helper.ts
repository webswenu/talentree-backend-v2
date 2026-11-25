import * as path from 'path';

/**
 * Resuelve una ruta local guardada en la base (cvUrl, fileUrl de archivos
 * "legacy" que no están en S3) y garantiza que quede dentro de la carpeta
 * `uploads` del proceso. Devuelve null si la ruta sale de ahí.
 *
 * El valor guardado no es confiable: hay DTOs que permiten escribirlo
 * directamente, así que nunca se usa tal cual con fs.
 */
export function resolverRutaEnUploads(
  rutaGuardada: string,
  base: string = process.cwd(),
): string | null {
  if (
    typeof rutaGuardada !== 'string' ||
    !rutaGuardada ||
    rutaGuardada.includes('\0')
  ) {
    return null;
  }

  const raiz = path.resolve(base, 'uploads');
  // Igual que antes (path.join con el cwd): una barra inicial no hace la ruta
  // absoluta. Se normalizan también las barras invertidas.
  const relativa = rutaGuardada.replace(/\\/g, '/').replace(/^\/+/, '');
  const destino = path.resolve(base, relativa);

  if (!destino.startsWith(raiz + path.sep)) {
    return null;
  }
  return destino;
}
