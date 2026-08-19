import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { QueryFailedExceptionFilter } from './query-failed-exception.filter';

/**
 * Filtro global de ultimo recurso.
 *
 * EL DEFECTO DE FONDO: no habia ningun `@Catch()` sin argumentos, asi que todo
 * lo que no fuera una excepcion de Nest salia con el texto por defecto del
 * framework, en ingles y sin decir que hacer. Verificado contra produccion el
 * 18-08-2026:
 *
 *   cuerpo JSON malformado  -> 400 "Unexpected token e in JSON at position 2"
 *   ruta o metodo que no existe -> 404 "Cannot PUT /api/v1/companies"
 *   cuerpo sobre 100 KB     -> 413 "request entity too large"
 *   rol sin permiso         -> 403 "Forbidden resource"
 *   cualquier TypeError     -> 500 "Internal server error"
 *
 * Los cinco los lee una persona en un aviso de la pantalla, porque el
 * interceptor de axios muestra `response.data.message` tal cual.
 *
 * Este filtro traduce SOLO esos textos por defecto. Cuando la aplicacion lanza
 * su propia excepcion con un mensaje escrito por nosotros, se respeta sin
 * tocarlo: ese mensaje casi siempre dice mas que cualquier texto generico.
 */
@Catch()
export class TodasLasExcepcionesFilter implements ExceptionFilter {
  private readonly logger = new Logger(TodasLasExcepcionesFilter.name);

  /**
   * Se delega en el filtro que ya existia en vez de duplicar su logica, que
   * tiene bastante detalle sobre los codigos de PostgreSQL. Va aqui adentro y
   * no como filtro aparte para no depender del orden en que Nest los prueba.
   */
  private readonly filtroDeConsultas = new QueryFailedExceptionFilter();

  /**
   * Textos por defecto del framework y su reemplazo. Se comparan en minusculas
   * y por inclusion, porque el detalle varia (la posicion del caracter que
   * rompio el JSON, el metodo y la ruta que no existen).
   */
  private traducirTextoPorDefecto(
    mensaje: string,
    status: number,
  ): string | null {
    const m = mensaje.toLowerCase();

    if (status === HttpStatus.PAYLOAD_TOO_LARGE || m.includes('too large')) {
      return 'Lo que intentaste enviar es demasiado grande. Si estas subiendo un archivo, prueba con uno mas liviano.';
    }

    // body-parser: JSON que no se puede leer.
    if (
      m.includes('unexpected token') ||
      m.includes('unexpected end of json') ||
      m.includes('in json at position') ||
      m.includes('entity.parse.failed')
    ) {
      return 'No pudimos leer los datos que enviaste. Vuelve a cargar la página e intenta nuevamente.';
    }

    // Nest, cuando ninguna ruta calza: "Cannot PUT /api/v1/companies".
    if (/^cannot (get|post|put|patch|delete|head|options) /.test(m)) {
      return 'Esa dirección no existe en la API. Si llegaste por un enlace, puede estar desactualizado.';
    }

    // RolesGuard devuelve false y Nest responde con este texto.
    if (m === 'forbidden resource') {
      return 'No tienes permiso para realizar esta acción con tu tipo de cuenta.';
    }

    if (m === 'unauthorized') {
      return 'Necesitas iniciar sesión para continuar.';
    }

    if (m === 'internal server error') {
      return 'No pudimos completar la operación. El problema es nuestro, no tuyo: tus datos siguen ahí. Intenta nuevamente en unos minutos.';
    }

    if (status === HttpStatus.UNSUPPORTED_MEDIA_TYPE) {
      return 'El formato de lo que enviaste no es el que esperábamos. Vuelve a cargar la página e intenta nuevamente.';
    }

    return null;
  }

  catch(exception: unknown, host: ArgumentsHost) {
    // Los errores de base de datos ya tienen su propio tratamiento.
    if (exception instanceof QueryFailedError) {
      return this.filtroDeConsultas.catch(exception, host);
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const cuerpo = exception.getResponse();

      /**
       * Un cuerpo con `message` como arreglo viene del ValidationPipe: son las
       * validaciones campo por campo, ya traducidas, y son justo lo mas util
       * que puede recibir la persona. No se tocan.
       */
      if (typeof cuerpo === 'object' && cuerpo !== null) {
        const mensaje = (cuerpo as { message?: unknown }).message;

        if (Array.isArray(mensaje)) {
          return response.status(status).json(cuerpo);
        }

        if (typeof mensaje === 'string') {
          const reemplazo = this.traducirTextoPorDefecto(mensaje, status);
          if (!reemplazo) {
            return response.status(status).json(cuerpo);
          }

          this.logger.warn(
            `Texto por defecto del framework reemplazado (${status}) en ${request.method} ${request.url}: "${mensaje}"`,
          );

          return response.status(status).json({
            ...(cuerpo as Record<string, unknown>),
            message: reemplazo,
          });
        }

        return response.status(status).json(cuerpo);
      }

      // Cuerpo de texto plano.
      const texto = String(cuerpo);
      const reemplazo = this.traducirTextoPorDefecto(texto, status);

      return response.status(status).json({
        statusCode: status,
        message: reemplazo ?? texto,
        error: HttpStatus[status] ?? 'Error',
      });
    }

    /**
     * Cualquier cosa que no sea una excepcion HTTP es un fallo nuestro: un
     * TypeError, una promesa rechazada, una libreria que revienta. La persona
     * no tiene nada que corregir, y decirle "verifica los datos" la manda a
     * buscar un error que no existe.
     */
    const detalle =
      exception instanceof Error ? exception.stack || exception.message : String(exception);

    this.logger.error(
      `Excepción no controlada en ${request.method} ${request.url}: ${detalle}`,
    );

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        'No pudimos completar la operación. El problema es nuestro, no tuyo: tus datos siguen ahí. Intenta nuevamente en unos minutos.',
      error: 'Internal Server Error',
    });
  }
}
