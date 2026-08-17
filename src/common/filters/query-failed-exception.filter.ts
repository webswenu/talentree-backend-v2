import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch(QueryFailedError)
export class QueryFailedExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(QueryFailedExceptionFilter.name);

  /**
   * Mensajes de error por clave foránea (hallazgos P-49 y P-29).
   *
   * EL DEFECTO DE FONDO: la versión anterior decidía si la operación era una
   * inserción o un borrado buscando la palabra "update" en el mensaje de
   * PostgreSQL. Pero al BORRAR una fila referenciada, PostgreSQL responde
   * literalmente «update or delete on table "tests" violates foreign key
   * constraint ... on table "test_responses"». Contiene "update", así que
   * todos los borrados caían en la rama de inserción.
   *
   * Por eso, al intentar eliminar un test que ya rindieron candidatos, el
   * sistema respondía «No se puede CREAR la respuesta del test porque el test
   * referenciado no existe», que no tiene nada que ver con lo que se pidió.
   *
   * El discriminador correcto está en el detalle, no en el mensaje:
   *   - borrado bloqueado  -> "is still referenced from table"
   *   - referencia inválida -> "is not present in table"
   */
  private mensajeParaClaveForanea(pgError: any): string {
    const mensaje: string = pgError.message || '';
    const detalle: string = pgError.detail || '';
    const texto = `${mensaje} ${detalle}`;

    const esBorradoBloqueado = detalle.includes('is still referenced from');

    if (esBorradoBloqueado) {
      // Mensajes por tabla que referencia, del caso concreto al genérico.
      if (texto.includes('selection_processes')) {
        return 'No se puede eliminar porque tiene procesos de selección asociados. Elimina o transfiere esos procesos primero.';
      }

      // P-49
      if (texto.includes('test_responses')) {
        return 'No se puede eliminar este test porque algunos candidatos ya lo rindieron. Puedes desactivarlo para que no se asigne a nuevos procesos.';
      }

      // P-29
      if (texto.includes('companies')) {
        return 'No se puede eliminar este usuario porque es el representante de una empresa. Asigna otro representante antes de eliminarlo.';
      }

      if (texto.includes('worker_processes')) {
        return 'No se puede eliminar porque tiene postulaciones asociadas. Revisa los candidatos vinculados antes de continuar.';
      }

      if (texto.includes('reports')) {
        return 'No se puede eliminar porque tiene informes asociados.';
      }

      return 'No se puede eliminar porque otros registros dependen de este. Elimina primero los datos relacionados.';
    }

    // Referencia que no existe (INSERT o UPDATE).
    return 'La operación hace referencia a un registro que no existe. Verifica los datos e intenta nuevamente.';
  }

  catch(exception: QueryFailedError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const pgError = exception as any;
    const errorMessage = pgError.message || '';
    const errorCode = pgError.code;

    this.logger.error(
      `[QueryFailedExceptionFilter] QueryFailedError capturado: código=${errorCode}, mensaje=${errorMessage}, ruta=${request.url}`,
    );

    // Código 23503 es foreign key constraint violation en PostgreSQL
    if (errorCode === '23503') {
      const userMessage = this.mensajeParaClaveForanea(pgError);

      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: userMessage,
        error: 'Bad Request',
      });
      return;
    }

    // Código 23505 es unique constraint violation
    if (errorCode === '23505') {
      let userMessage = 'Este registro ya existe en el sistema.';

      if (errorMessage.includes('email') || errorMessage.includes('UQ_97672ac88f789774dd47f7c8be3') || errorMessage.includes('UQ_87f2092ffaae628ef63547d2442')) {
        userMessage = 'El email ingresado ya está registrado en el sistema.';
      }

      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: userMessage,
        error: 'Bad Request',
      });
      return;
    }

    // Otros errores de base de datos - también devolver BadRequest para evitar 500
    this.logger.warn(`Error de base de datos no manejado: código=${errorCode}`);
    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Error en la operación de base de datos. Por favor, verifique los datos e intente nuevamente.',
      error: 'Bad Request',
    });
  }
}

