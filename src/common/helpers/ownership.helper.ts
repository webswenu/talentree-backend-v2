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

/**
 * El id del usuario de la sesion.
 *
 * OJO, ESTA ES LA TRAMPA QUE HAY QUE CONOCER: `jwt.strategy.ts` devuelve la
 * ENTIDAD `User`, que tiene `id`. Pero varios sitios del codigo escribieron
 * `user.sub`, que es el nombre del claim DENTRO del token y aqui vale
 * `undefined`. Una comprobacion escrita contra `user.sub` no protege nada
 * cuando deja pasar, y bloquea a todo el mundo cuando corta.
 *
 * Se aceptan los dos por si algun dia la estrategia devuelve el payload crudo,
 * pero lo correcto es `id`.
 */
export function resolveUserId(user: any): string | null {
  return user?.id ?? user?.sub ?? null;
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

/** Datos minimos de una postulacion para decidir quien puede tocarla. */
export interface DuenosDePostulacion {
  /** Id del USUARIO del candidato dueño de la postulacion. */
  usuarioDelCandidato: string | null | undefined;
  /** Id de la empresa del proceso al que postula. */
  empresaDelProceso: string | null | undefined;
  /** Ids de los usuarios evaluadores asignados a ese proceso. */
  evaluadoresDelProceso: string[];
}

/**
 * Quien puede ver o tocar una postulacion y sus respuestas de test.
 *
 * EL DEFECTO QUE CIERRA: en `test-responses.service.ts` habia dos controles
 * comentados con la nota `// TEMPORARILY DISABLED FOR TESTING`, y otros dos
 * endpoints que nunca tuvieron control. Solo se comprobaba el ROL, asi que
 * cualquier candidato con sesion iniciada podia, sabiendo el UUID:
 *   - leer las respuestas y el perfil psicometrico de otro candidato,
 *   - ENVIAR el test de otro con `{"answers":[]}` y dejarselo cerrado,
 *   - arrancar un test sobre la postulacion de otro.
 * Y una empresa podia leer los tests de los candidatos de otra empresa.
 *
 * Las reglas, en el mismo orden en que se aplican:
 *   Talentree  -> todo
 *   candidato  -> solo lo suyo
 *   empresa    -> solo lo de su empresa (delegado en assertBelongsToUserCompany)
 *   invitado   -> igual que empresa
 *   evaluador  -> solo los procesos que tiene asignados
 */
export function assertPuedeAccederAPostulacion(
  user: any,
  duenos: DuenosDePostulacion,
  recurso = 'esta postulación',
): void {
  /**
   * Sin usuario no se decide nada: se corta.
   *
   * Es a proposito que falle CERRADA. Si en algun refactor alguien deja de
   * pasar `req.user`, lo correcto es que el endpoint deje de funcionar y se
   * note, y no que pase de largo y vuelva a quedar abierto en silencio, que es
   * exactamente como nacio este agujero. Verificado antes de ponerlo: los
   * cuatro endpoints de test-responses y los cinco de envio de test son los
   * unicos que llaman aqui, y todos reciben el usuario desde el controlador.
   */
  if (!user?.role) {
    throw new ForbiddenException(
      `No pudimos verificar tu sesión para acceder a ${recurso}. Vuelve a iniciar sesión.`,
    );
  }

  const rol = user.role;

  if (rol === UserRole.ADMIN_TALENTREE) return;

  if (rol === UserRole.WORKER) {
    const propio = resolveUserId(user);

    if (!propio || !duenos.usuarioDelCandidato) {
      throw new ForbiddenException(
        `No tienes permiso para acceder a ${recurso}.`,
      );
    }

    if (propio !== duenos.usuarioDelCandidato) {
      throw new ForbiddenException(
        `No tienes permiso para acceder a ${recurso}: es de otro candidato.`,
      );
    }

    return;
  }

  /**
   * DECISION EXPLICITA (Matias, 18-08-2026): el evaluador queda FUERA de este
   * recorte por ahora y sigue viendo todo, como hasta hoy.
   *
   * El motivo es operativo, no tecnico: al 18-08-2026 NINGUNO de los 6
   * procesos de produccion tiene evaluadores asignados, asi que exigir la
   * asignacion habria dejado a los 2 evaluadores con 403 en cada test que
   * abrieran, hasta que la clienta los asignara proceso por proceso.
   *
   * LO QUE QUEDA ABIERTO, para que no se pierda: un evaluador puede ver los
   * candidatos y los tests de empresas que no le corresponden. Es un rol
   * interno que crea Talentree a mano (no hay registro publico de evaluadores),
   * asi que el riesgo es de confidencialidad entre clientas, no de que un
   * desconocido entre desde la calle.
   *
   * Para cerrarlo: asignar evaluadores a los procesos y reemplazar este bloque
   * por la comprobacion contra `duenos.evaluadoresDelProceso`, que ya viene
   * calculada y llega hasta aca sin usarse.
   */
  if (rol === UserRole.EVALUATOR) return;

  if (isCompanyScopedRole(rol)) {
    assertBelongsToUserCompany(user, duenos.empresaDelProceso, recurso);
    return;
  }

  /**
   * Cualquier rol que no este contemplado arriba no pasa.
   *
   * Antes esta funcion terminaba delegando en `assertBelongsToUserCompany`,
   * que retorna temprano cuando el rol no es de empresa: un rol nuevo o mal
   * escrito habria pasado de largo. Hoy el guard de roles lo haria imposible,
   * pero esa es exactamente la clase de suposicion que dejo este agujero
   * abierto la primera vez.
   */
  throw new ForbiddenException(
    `No tienes permiso para acceder a ${recurso} con tu tipo de cuenta.`,
  );
}
