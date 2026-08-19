import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { TodasLasExcepcionesFilter } from './todas-las-excepciones.filter';

/** Arma el ArgumentsHost minimo que el filtro necesita. */
const armarHost = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', url: '/api/v1/companies' }),
    }),
  } as any;

  return { host, status, json, cuerpo: () => json.mock.calls[0][0] };
};

describe('TodasLasExcepcionesFilter', () => {
  let filtro: TodasLasExcepcionesFilter;

  beforeEach(() => {
    filtro = new TodasLasExcepcionesFilter();
    jest.spyOn(filtro['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(filtro['logger'], 'error').mockImplementation(() => undefined);
  });

  describe('textos por defecto del framework, verificados en produccion', () => {
    it('traduce el error del lector de JSON', () => {
      const { host, status, cuerpo } = armarHost();

      filtro.catch(
        new BadRequestException('Unexpected token e in JSON at position 2'),
        host,
      );

      expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(cuerpo().message).toBe(
        'No pudimos leer los datos que enviaste. Vuelve a cargar la página e intenta nuevamente.',
      );
    });

    it('traduce la ruta que no existe', () => {
      const { host, cuerpo } = armarHost();

      filtro.catch(new NotFoundException('Cannot PUT /api/v1/companies'), host);

      expect(cuerpo().message).toContain('Esa dirección no existe en la API');
    });

    it('traduce el cuerpo demasiado grande', () => {
      const { host, status, cuerpo } = armarHost();

      filtro.catch(new PayloadTooLargeException('request entity too large'), host);

      expect(status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
      expect(cuerpo().message).toContain('demasiado grande');
    });

    it('traduce el «Forbidden resource» del guard de roles', () => {
      const { host, cuerpo } = armarHost();

      filtro.catch(new ForbiddenException('Forbidden resource'), host);

      expect(cuerpo().message).toBe(
        'No tienes permiso para realizar esta acción con tu tipo de cuenta.',
      );
    });
  });

  describe('lo que NO debe tocar', () => {
    it('respeta el mensaje que escribimos nosotros', () => {
      const { host, cuerpo } = armarHost();
      const propio = 'Ya existe una invitación pendiente para este email en este proceso';

      filtro.catch(new HttpException(propio, HttpStatus.CONFLICT), host);

      expect(cuerpo().message).toBe(propio);
    });

    it('deja intacto el arreglo de validaciones del ValidationPipe', () => {
      const { host, cuerpo } = armarHost();
      const validaciones = [
        'El email debe ser una direccion de correo valida.',
        'La contrasena debe tener al menos 8 caracteres.',
      ];

      filtro.catch(new BadRequestException(validaciones), host);

      expect(cuerpo().message).toEqual(validaciones);
    });
  });

  describe('lo que antes salia en ingles y como 500 pelado', () => {
    it('convierte una excepcion cualquiera en un 500 que no culpa a la persona', () => {
      const { host, status, cuerpo } = armarHost();

      filtro.catch(new TypeError("Cannot read properties of undefined"), host);

      expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(cuerpo().message).toContain('El problema es nuestro, no tuyo');
      expect(cuerpo().message).not.toContain('Cannot read properties');
    });

    it('no filtra el detalle interno de la excepcion', () => {
      const { host, cuerpo } = armarHost();

      filtro.catch(new Error('connect ECONNREFUSED 127.0.0.1:5432'), host);

      expect(JSON.stringify(cuerpo())).not.toContain('ECONNREFUSED');
    });
  });

  describe('errores de base de datos', () => {
    const errorPg = (code: string, message: string) => {
      const e = new QueryFailedError('SELECT 1', [], new Error(message) as any);
      (e as any).code = code;
      (e as any).message = message;
      return e;
    };

    it('un identificador mal formado ya no se reporta como falla de la base', () => {
      const { host, status, cuerpo } = armarHost();

      filtro.catch(
        errorPg('22P02', 'invalid input syntax for type uuid: "no-soy-un-uuid"'),
        host,
      );

      expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(cuerpo().message).toContain('El identificador de la dirección no es válido');
      expect(cuerpo().message).not.toContain('base de datos');
    });

    it('una fecha imposible dice que es la fecha y no «verifique los datos»', () => {
      const { host, cuerpo } = armarHost();

      filtro.catch(errorPg('22007', 'invalid input syntax for type timestamp'), host);

      expect(cuerpo().message).toContain('AAAA-MM-DD');
    });

    it('un fallo de base desconocido responde 500 y no 400', () => {
      const { host, status, cuerpo } = armarHost();

      filtro.catch(errorPg('42703', 'column "inexistente" does not exist'), host);

      expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(cuerpo().message).toContain('El problema es nuestro');
      expect(JSON.stringify(cuerpo())).not.toContain('column');
    });

    it('sigue explicando el borrado bloqueado por datos asociados', () => {
      const { host, status, cuerpo } = armarHost();
      const e = errorPg(
        '23503',
        'update or delete on table "companies" violates foreign key constraint',
      );
      (e as any).detail =
        'Key (id)=(1) is still referenced from table "selection_processes".';

      filtro.catch(e, host);

      expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(cuerpo().message).toContain('procesos de selección asociados');
    });
  });
});
