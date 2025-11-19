import { Injectable, ExecutionContext } from '@nestjs/common';
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
}
