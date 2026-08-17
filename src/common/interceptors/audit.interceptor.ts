import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';
import { AuditAction } from '../enums/audit-action.enum';

/**
 * Bitácora de auditoría.
 *
 * Tres defectos que el QA encontró aquí y que se corrigen juntos porque son el
 * mismo bloque de código:
 *
 *  P-42: `entityType` guardaba 'v1' en TODOS los registros. La URL es
 *        /api/v1/companies/... y se tomaba pathParts[1], que es el 'v1' del
 *        prefijo. La bitácora quedaba inservible para saber qué se tocó.
 *
 *  P-43: las eliminaciones NO se auditaban. La condición exigía que hubiera
 *        cuerpo en la respuesta (`response`), y un DELETE responde 204 sin
 *        cuerpo. Es decir: lo único que no quedaba registrado era justo la
 *        operación más destructiva. Y al mismo tiempo la bitácora se llenaba
 *        de lecturas, que son la inmensa mayoría del tráfico.
 *
 *  P-44: los inicios y cierres de sesión no aparecían. Se registran ahora de
 *        forma explícita desde el servicio de autenticación (ver auth.service),
 *        porque en el momento en que pasa el interceptor todavía no hay
 *        usuario en la petición.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly prefijoApi: string[];

  constructor(
    private readonly auditService: AuditService,
    private readonly configService?: ConfigService,
  ) {
    const prefijo =
      this.configService?.get<string>('API_PREFIX') || 'api/v1';
    this.prefijoApi = prefijo.split('/').filter(Boolean);
  }

  /**
   * Entidades cuya LECTURA sí interesa auditar, por ser datos sensibles:
   * quién miró el informe psicotécnico de quién es exactamente el tipo de
   * pregunta que una bitácora tiene que poder responder.
   */
  private static readonly LECTURAS_AUDITABLES = new Set([
    'reports',
    'test-responses',
    'audit',
  ]);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';

    const actionMap: Record<string, AuditAction> = {
      POST: AuditAction.CREATE,
      GET: AuditAction.READ,
      PATCH: AuditAction.UPDATE,
      PUT: AuditAction.UPDATE,
      DELETE: AuditAction.DELETE,
    };

    const action = actionMap[method] || AuditAction.READ;
    const entityType = this.extraerEntidad(url);

    // P-43: la bitácora servía de poco llena de lecturas. Se registran todas
    // las escrituras y solo las lecturas de recursos sensibles.
    const hayQueAuditar =
      action !== AuditAction.READ ||
      AuditInterceptor.LECTURAS_AUDITABLES.has(entityType);

    if (!hayQueAuditar) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((response) => {
        // P-43: antes exigía `response`, así que un DELETE (204 sin cuerpo)
        // nunca se registraba. Basta con que la petición haya terminado bien:
        // si hubiera fallado, `tap` no se ejecuta.
        if (!user) return;

        const entityId =
          response?.id || request.params?.id || request.query?.id;

        this.auditService
          .log(action, entityType, entityId, user.id, {
            ipAddress: ip,
            userAgent,
            newValues:
              method === 'POST' || method === 'PATCH' || method === 'PUT'
                ? this.sinDatosSensibles(request.body)
                : undefined,
          })
          .catch((error) => {
            console.error('Audit log failed:', error);
          });
      }),
    );
  }

  /**
   * P-42. Quita el prefijo configurado del comienzo de la URL y toma el primer
   * segmento de lo que queda, en vez de confiar en una posición fija: así
   * sigue funcionando si API_PREFIX cambia o desaparece.
   */
  private extraerEntidad(url: string): string {
    const partes = (url || '').split('?')[0].split('/').filter(Boolean);

    let i = 0;
    while (i < this.prefijoApi.length && partes[i] === this.prefijoApi[i]) {
      i++;
    }

    return partes[i] || 'unknown';
  }

  /**
   * El cuerpo de la petición se guarda tal cual en la bitácora, así que una
   * creación de usuario dejaba la contraseña en claro en la base.
   */
  private sinDatosSensibles(
    body: Record<string, any> | undefined,
  ): Record<string, any> | undefined {
    if (!body || typeof body !== 'object') return body;

    const OCULTAR = [
      'password',
      'newPassword',
      'currentPassword',
      'confirmPassword',
      'accessToken',
      'refreshToken',
      'token',
    ];

    const copia = { ...body };
    for (const campo of OCULTAR) {
      if (campo in copia) copia[campo] = '***';
    }

    return copia;
  }
}
