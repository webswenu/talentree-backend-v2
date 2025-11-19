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
      let userMessage = 'No se puede realizar esta operación porque viola una restricción de integridad.';

      // Detectar si es INSERT/UPDATE vs DELETE
      const isInsertOrUpdate = errorMessage.toLowerCase().includes('insert') ||
                                errorMessage.toLowerCase().includes('update');

      if (errorMessage.includes('selection_processes')) {
        userMessage =
          'No se puede eliminar la empresa porque tiene procesos de selección asociados. Por favor, elimine o transfiera los procesos antes de eliminar la empresa.';
      } else if (isInsertOrUpdate) {
        // Error en INSERT/UPDATE - referencia no existe
        if (errorMessage.includes('test_responses')) {
          userMessage =
            'No se puede crear la respuesta del test porque el test referenciado no existe. Verifique que el test esté correctamente configurado.';
        } else {
          userMessage =
            'No se puede realizar esta operación porque hace referencia a datos que no existen. Verifique los datos e intente nuevamente.';
        }
      } else {
        // Error en DELETE - tiene datos asociados
        userMessage =
          'No se puede eliminar este recurso porque tiene datos asociados. Por favor, elimine primero los datos relacionados.';
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

