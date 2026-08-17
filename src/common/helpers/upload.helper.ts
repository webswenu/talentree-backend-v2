import { BadRequestException } from '@nestjs/common';

/**
 * Validacion de archivos subidos (hallazgo P-82).
 *
 * La subida de informes no validaba ni formato ni tamano: se probo con un .exe
 * y quedo guardado como si fuera el documento del informe, y un archivo de
 * 60 MB entro sin limite. El patron correcto ya existia en el proyecto (el
 * logo y el video si validan); aqui queda en un solo lugar para no repetirlo.
 *
 * Dos comprobaciones, porque ninguna basta sola:
 *  - El MIME que declara el navegador, que es lo que mira multer.
 *  - Los primeros bytes del archivo, porque renombrar un .exe a .pdf es trivial
 *    y el MIME tambien se puede falsear.
 */

export const MIME_PDF = 'application/pdf';
export const MIME_DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MIME_DOC = 'application/msword';

/** Firmas de archivo (magic bytes) de los formatos que aceptamos. */
const FIRMAS: Array<{ bytes: number[]; nombre: string }> = [
  { bytes: [0x25, 0x50, 0x44, 0x46], nombre: 'PDF' }, // %PDF
  { bytes: [0x50, 0x4b, 0x03, 0x04], nombre: 'DOCX' }, // ZIP: docx es un zip
  { bytes: [0xd0, 0xcf, 0x11, 0xe0], nombre: 'DOC' }, // OLE2: .doc antiguo
];

export const TAMANO_MAXIMO_INFORME = 20 * 1024 * 1024; // 20 MB

/**
 * fileFilter para el FileInterceptor de documentos de informe.
 * Rechaza antes de que el archivo llegue a memoria completa.
 */
export function filtroDocumentoInforme(
  _req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, acepta: boolean) => void,
): void {
  const permitidos = [MIME_PDF, MIME_DOCX, MIME_DOC];

  if (!permitidos.includes(file.mimetype)) {
    return callback(
      new BadRequestException(
        'Formato no permitido. El informe debe ser un archivo PDF o Word (.docx).',
      ),
      false,
    );
  }

  callback(null, true);
}

/**
 * Comprobacion de los bytes de cabecera, ya con el archivo en mano.
 * Es la que atrapa el ejecutable renombrado, que el MIME deja pasar.
 */
export function verificarFirmaDocumento(file: Express.Multer.File): void {
  if (!file?.buffer || file.buffer.length < 4) {
    throw new BadRequestException('El archivo llego vacio o incompleto.');
  }

  const cabecera = Array.from(file.buffer.subarray(0, 4));
  const coincide = FIRMAS.some((f) =>
    f.bytes.every((b, i) => cabecera[i] === b),
  );

  if (!coincide) {
    throw new BadRequestException(
      'El contenido del archivo no corresponde a un PDF ni a un documento Word, ' +
        'aunque su nombre lo sugiera. Vuelve a exportarlo y subelo de nuevo.',
    );
  }
}

/**
 * El tipo real del documento, decidido por el contenido y no por el nombre.
 * `path.extname()` sobre `originalname` es texto que elige quien sube.
 */
export function esPdf(file: Express.Multer.File): boolean {
  if (file.mimetype === MIME_PDF) return true;
  if (!file.buffer || file.buffer.length < 4) return false;
  return (
    file.buffer[0] === 0x25 &&
    file.buffer[1] === 0x50 &&
    file.buffer[2] === 0x44 &&
    file.buffer[3] === 0x46
  );
}
