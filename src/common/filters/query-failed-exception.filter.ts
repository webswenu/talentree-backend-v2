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
      /**
       * OJO: hay que mirar la tabla QUE REFERENCIA, no cualquier aparición en
       * el texto. El mensaje de PostgreSQL nombra las DOS tablas:
       *
       *   update or delete on table "selection_processes"      <- de la que se borra
       *   violates ... on table "process_invitations"          <- la que referencia
       *   DETAIL: Key (id)=(…) is still referenced from table "process_invitations".
       *
       * Buscar 'selection_processes' en el texto completo hacía que al borrar
       * un PROCESO se respondiera "tiene procesos de selección asociados", que
       * es el mensaje del caso de las empresas. El dato fiable está en el
       * detalle, que nombra solo la tabla que referencia.
       */
      const m = detalle.match(/is still referenced from table "([^"]+)"/);
      const referencia = m ? m[1] : '';

      const POR_TABLA: Record<string, string> = {
        selection_processes:
          'No se puede eliminar porque tiene procesos de selección asociados. Elimina o transfiere esos procesos primero.',
        // P-49
        test_responses:
          'No se puede eliminar este test porque algunos candidatos ya lo rindieron. Puedes desactivarlo para que no se asigne a nuevos procesos.',
        // P-29
        companies:
          'No se puede eliminar este usuario porque es el representante de una empresa. Asigna otro representante antes de eliminarlo.',
        worker_processes:
          'No se puede eliminar porque tiene candidatos postulados. Revisa las postulaciones antes de continuar.',
        process_invitations:
          'No se puede eliminar porque tiene invitaciones enviadas.',
        reports: 'No se puede eliminar porque tiene informes asociados.',
      };

      return (
        POR_TABLA[referencia] ||
        'No se puede eliminar porque otros registros dependen de este. Elimina primero los datos relacionados.'
      );
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

    /**
     * 22P02 es invalid_text_representation: PostgreSQL recibio un texto que no
     * puede convertir al tipo de la columna. En la practica siempre es lo
     * mismo: un identificador de la URL que no tiene forma de UUID.
     *
     * Verificado en produccion el 18-08-2026: `GET /companies/no-soy-un-uuid`
     * respondia «Error en la operacion de base de datos. Por favor, verifique
     * los datos e intente nuevamente», que le echa la culpa a la base y manda a
     * la persona a revisar unos datos que estan bien. El error esta en el
     * enlace, y eso es lo que hay que decirle.
     */
    if (errorCode === '22P02') {
      const esUuid = /invalid input syntax for type uuid/i.test(errorMessage);

      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: esUuid
          ? 'El identificador de la dirección no es válido. Si llegaste por un enlace, puede estar mal copiado o incompleto.'
          : 'Uno de los datos enviados no tiene el formato que corresponde. Revísalo e intenta nuevamente.',
        error: 'Bad Request',
      });
      return;
    }

    // 22007 / 22008: fecha u hora que PostgreSQL no puede interpretar.
    if (errorCode === '22007' || errorCode === '22008') {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message:
          'Una de las fechas no es válida. Usa el formato AAAA-MM-DD, por ejemplo 2026-08-18.',
        error: 'Bad Request',
      });
      return;
    }

    /**
     * Lo que queda es un fallo nuestro: una columna que no existe, una
     * conexion caida, una restriccion que no contemplamos. Antes todo esto
     * salia como 400 «verifique los datos», que le pide a la persona corregir
     * algo que no depende de ella. Un 5xx es la verdad, y ademas el front ya
     * tiene un texto propio para los 5xx que dice que el problema es nuestro.
     */
    this.logger.error(
      `Error de base de datos no manejado: código=${errorCode}, mensaje=${errorMessage}, ruta=${request.url}`,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        'No pudimos completar la operación. El problema es nuestro, no tuyo: tus datos siguen ahí. Intenta nuevamente en unos minutos.',
      error: 'Internal Server Error',
    });
  }
}

