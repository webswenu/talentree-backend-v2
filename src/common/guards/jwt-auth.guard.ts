import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // Si es público, intentar procesar el token de todas formas (pero sin fallar)
      try {
        await super.canActivate(context);
        return true;
      } catch (error) {
        // Ignorar errores - el usuario simplemente no está autenticado
        return true;
      }
    }

    return super.canActivate(context) as boolean | Promise<boolean>;
  }

  /**
   * Sin esto, Passport responde el texto por defecto "Unauthorized": en
   * ingles y sin decir que hacer. Es justo el mensaje que ve una persona
   * cuando se le vence la sesion, que es el caso mas frecuente de todos.
   */
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      const expirado = info?.name === 'TokenExpiredError';
      throw (
        err ||
        new UnauthorizedException(
          expirado
            ? 'Tu sesión expiró por inactividad. Vuelve a iniciar sesión para continuar.'
            : 'Necesitas iniciar sesión para ver esta información.',
        )
      );
    }
    return user;
  }
}
