import { VideoRequirementsService } from './video-requirements.service';

/**
 * Fija el cierre del recorrido de rutas.
 *
 * Antes, cuando la ubicación guardada no empezaba con `videos/`, el servicio
 * leía del disco con `path.join(process.cwd(), videoUrl)` sin contener la ruta.
 * Y `videoUrl` la elige quien sube el video, que es un candidato: rol de
 * registro público. Con `a.com/../../../../etc/passwd` se servía `/etc/passwd`,
 * y en ese host el `.env` tiene el JWT_SECRET.
 */
describe('VideoRequirementsService · ubicación del video', () => {
  let servicio: any;

  beforeEach(() => {
    servicio = Object.create(VideoRequirementsService.prototype);
  });

  const valida = (clave: string) => servicio.esClaveDeVideoValida(clave);

  describe('acepta solo el almacenamiento de videos', () => {
    it('acepta una clave normal', () => {
      expect(valida('videos/abc-123/1787082632348-uuid.webm')).toBe(true);
    });

    it('acepta subcarpetas', () => {
      expect(valida('videos/2026/08/grabacion.webm')).toBe(true);
    });
  });

  describe('rechaza todo lo demás', () => {
    /** La carga exacta que funcionaba en producción. */
    it('rechaza el recorrido de rutas sin protocolo', () => {
      expect(valida('a.com/../../../../etc/passwd')).toBe(false);
    });

    it('rechaza cualquier ruta con dos puntos', () => {
      expect(valida('videos/../../../etc/passwd')).toBe(false);
      expect(valida('videos/ok/../../../.env')).toBe(false);
    });

    it('rechaza rutas absolutas', () => {
      expect(valida('/etc/passwd')).toBe(false);
      expect(valida('/home/ubuntu/talentree-backend-v2/.env')).toBe(false);
    });

    it('rechaza carpetas que no son la de videos', () => {
      expect(valida('reports/informe.docx')).toBe(false);
      expect(valida('cvs/curriculum.pdf')).toBe(false);
      expect(valida('.env')).toBe(false);
    });

    it('rechaza barras invertidas de Windows', () => {
      expect(valida('videos\\..\\..\\.env')).toBe(false);
    });

    it('rechaza el vacío y lo que no sea texto', () => {
      expect(valida('')).toBe(false);
      expect(valida(null as any)).toBe(false);
      expect(valida(undefined as any)).toBe(false);
      expect(valida({} as any)).toBe(false);
    });

    it('rechaza el intento de esconder la carpeta al final', () => {
      expect(valida('otracosa/videos/x.webm')).toBe(false);
    });
  });
});
