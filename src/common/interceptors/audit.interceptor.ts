import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';
import { AuditAction } from '../enums/audit-action.enum';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

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

    const pathParts = url.split('/').filter(Boolean);
    const entityType = pathParts[1] || 'unknown'; // Skip 'api'

    return next.handle().pipe(
      tap((response) => {
        if (user && response) {
          const entityId =
            response?.id || request.params?.id || request.query?.id;

          this.auditService
            .log(action, entityType, entityId, user.id, {
              ipAddress: ip,
              userAgent,
              newValues:
                method === 'POST' || method === 'PATCH'
                  ? request.body
                  : undefined,
            })
            .catch((error) => {
              console.error('Audit log failed:', error);
            });
        }
      }),
    );
  }
}
