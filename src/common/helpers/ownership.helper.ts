import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

/**
 * Pertenencia de recursos.
 *
 * El defecto de fondo que dio origen a este archivo (hallazgos P-22, P-35 y
 * P-81 del QA) es que el backend comprobaba el ROL pero nunca la PERTENENCIA:
 * bastaba tener rol COMPANY para leer los procesos, los candidatos y los
 * informes de cualquier otra empresa, incluida la competencia.
 *
 * Aqui viven las dos preguntas que hay que hacerse en cada endpoint que
 * recibe un :id: de que empresa es quien pregunta, y puede ver esto.
 */

/**
 * Centinela para acotar una consulta a "ninguna empresa".
 *
 * Cuando un usuario de rol COMPANY o GUEST todavia no tiene empresa asignada,
 * el recorte tiene que devolver CERO filas. Filtrar por null en TypeORM no
 * sirve (se omite la condicion y devuelve todo, que es justo el defecto que se
 * esta corrigiendo), asi que se filtra por un UUID que no existe.
 */
export const NO_COMPANY = '00000000-0000-0000-0000-000000000000';

/**
 * La empresa a la que pertenece un usuario.
 *
 * Hay dos caminos y ambos son legitimos:
 *  - `company`  : la empresa que este usuario REPRESENTA (rol COMPANY).
 *  - `companyId`: la empresa a la que este usuario FUE INVITADO (rol GUEST).
 *
 * Devuelve null para Talentree, evaluadores y candidatos, que no cuelgan de
 * ninguna empresa.
 *
 * OJO CON `company` DESDE QUE EXISTE EL MULTI-EMPRESA: un representante puede
 * tener VARIAS empresas (`user.companies`), y `user.company` es la ACTIVA, la
 * que resuelve UsersService.findOneWithRelations al cargar la sesion. Sigue
 * siendo una sola a proposito: el recorte de datos nunca mezcla dos empresas,
 * y lo unico que cambio es que ahora la elige el usuario en un selector en vez
 * de imponerla el modelo. Si alguna vez esto pasara a devolver una lista, hay
 * que revisar TODAS las consultas que lo consumen, porque estan escritas
 * asumiendo un unico id.
 */
export function resolveUserCompanyId(user: any): string | null {
  return user?.company?.id ?? user?.companyId ?? null;
}

/** Roles que solo pueden ver lo de SU empresa. */
export function isCompanyScopedRole(role: UserRole | string): boolean {
  return role === UserRole.COMPANY || role === UserRole.GUEST;
}

/** El rol Invitado es de solo consulta: nunca escribe. */
export function isReadOnlyRole(role: UserRole | string): boolean {
  return role === UserRole.GUEST;
}

/**
 * Corta el paso cuando el recurso pertenece a otra empresa.
 *
 * Se responde 403 y no 404 a proposito: el usuario esta autenticado y el
 * recurso existe, lo que falta es permiso. El mensaje no revela de quien es.
 */
export function assertBelongsToUserCompany(
  user: any,
  resourceCompanyId: string | null | undefined,
  recurso = 'este recurso',
): void {
  if (user?.role === UserRole.ADMIN_TALENTREE) return;
  if (!isCompanyScopedRole(user?.role)) return;

  const userCompanyId = resolveUserCompanyId(user);

  if (!userCompanyId) {
    throw new ForbiddenException(
      'Tu usuario todavia no tiene una empresa asignada. Contacta al administrador de Talentree.',
    );
  }

  if (!resourceCompanyId || resourceCompanyId !== userCompanyId) {
    throw new ForbiddenException(
      `No tienes permiso para acceder a ${recurso}: pertenece a otra empresa.`,
    );
  }
}
