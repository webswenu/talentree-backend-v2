import * as path from 'path';
import { resolverRutaEnUploads } from './ruta-local.helper';

/**
 * Fija que las rutas locales "legacy" (cvUrl, fileUrl) solo puedan apuntar a
 * archivos dentro de la carpeta uploads.
 *
 * Antes se hacía path.join(process.cwd(), worker.cvUrl) sin más. cvUrl llega
 * desde el PATCH /workers/:id (lo puede editar el propio postulante), así que
 * con un valor como "../.env" la descarga del CV devolvía cualquier archivo
 * del servidor y el borrado del CV podía eliminarlo.
 */
describe('resolverRutaEnUploads', () => {
  const base = path.resolve('/srv/app');
  const uploads = path.join(base, 'uploads');

  it('acepta una ruta dentro de uploads con o sin barra inicial', () => {
    expect(resolverRutaEnUploads('/uploads/cvs/cv.pdf', base)).toBe(
      path.join(uploads, 'cvs', 'cv.pdf'),
    );
    expect(resolverRutaEnUploads('uploads/reports/r.docx', base)).toBe(
      path.join(uploads, 'reports', 'r.docx'),
    );
  });

  it('rechaza salir de uploads con ..', () => {
    expect(resolverRutaEnUploads('../.env', base)).toBeNull();
    expect(resolverRutaEnUploads('uploads/../.env', base)).toBeNull();
    expect(resolverRutaEnUploads('/uploads/../../etc/passwd', base)).toBeNull();
    expect(resolverRutaEnUploads('uploads\\..\\.env', base)).toBeNull();
  });

  it('rechaza rutas fuera de uploads aunque no usen ..', () => {
    expect(resolverRutaEnUploads('.env', base)).toBeNull();
    expect(resolverRutaEnUploads('src/main.ts', base)).toBeNull();
    expect(resolverRutaEnUploads('uploads-falso/x.pdf', base)).toBeNull();
  });

  it('rechaza la carpeta uploads misma, vacíos y bytes nulos', () => {
    expect(resolverRutaEnUploads('uploads', base)).toBeNull();
    expect(resolverRutaEnUploads('', base)).toBeNull();
    expect(resolverRutaEnUploads('uploads/cv.pdf\0.txt', base)).toBeNull();
    expect(
      resolverRutaEnUploads(undefined as unknown as string, base),
    ).toBeNull();
  });
});
