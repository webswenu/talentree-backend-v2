import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';
import {
  assertPuedeAccederAPostulacion,
  resolveUserId,
  DuenosDePostulacion,
} from './ownership.helper';

const EMPRESA_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const EMPRESA_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const CANDIDATO = 'cccccccc-0000-4000-8000-000000000003';
const OTRO_CANDIDATO = 'dddddddd-0000-4000-8000-000000000004';
const EVALUADOR = 'eeeeeeee-0000-4000-8000-000000000005';
const OTRO_EVALUADOR = 'ffffffff-0000-4000-8000-000000000006';

/** La postulación de CANDIDATO a un proceso de EMPRESA_A, evaluado por EVALUADOR. */
const POSTULACION: DuenosDePostulacion = {
  usuarioDelCandidato: CANDIDATO,
  empresaDelProceso: EMPRESA_A,
  evaluadoresDelProceso: [EVALUADOR],
};

const intentar = (user: any, duenos = POSTULACION) => () =>
  assertPuedeAccederAPostulacion(user, duenos, 'este test');

describe('assertPuedeAccederAPostulacion', () => {
  describe('candidatos', () => {
    it('deja pasar al dueño de la postulación', () => {
      expect(intentar({ id: CANDIDATO, role: UserRole.WORKER })).not.toThrow();
    });

    /**
     * El caso que estaba abierto en producción: con el control comentado,
     * cualquier candidato podía leer el test de otro y, peor, enviárselo con
     * `{"answers":[]}` para dejárselo cerrado.
     */
    it('corta al candidato que intenta entrar al test de otro', () => {
      expect(intentar({ id: OTRO_CANDIDATO, role: UserRole.WORKER })).toThrow(
        ForbiddenException,
      );
    });

    it('dice que es de otro candidato, sin revelar de quién', () => {
      try {
        intentar({ id: OTRO_CANDIDATO, role: UserRole.WORKER })();
        fail('debió cortar');
      } catch (e) {
        expect(e.message).toContain('es de otro candidato');
        expect(e.message).not.toContain(CANDIDATO);
      }
    });

    /**
     * LA TRAMPA. Las líneas comentadas comparaban contra `user.sub`, pero la
     * estrategia JWT devuelve la entidad User, que tiene `id`. Reactivarlas tal
     * cual habría dado 403 a TODOS sobre su propio test.
     */
    it('un usuario con id correcto pasa aunque no tenga la propiedad sub', () => {
      const sesionReal = { id: CANDIDATO, role: UserRole.WORKER };

      expect(sesionReal).not.toHaveProperty('sub');
      expect(intentar(sesionReal)).not.toThrow();
    });

    it('resolveUserId prefiere id y acepta sub como respaldo', () => {
      expect(resolveUserId({ id: CANDIDATO, sub: OTRO_CANDIDATO })).toBe(CANDIDATO);
      expect(resolveUserId({ sub: CANDIDATO })).toBe(CANDIDATO);
      expect(resolveUserId({})).toBeNull();
    });

    it('corta si la postulación no tiene candidato resuelto', () => {
      expect(
        intentar(
          { id: CANDIDATO, role: UserRole.WORKER },
          { ...POSTULACION, usuarioDelCandidato: null },
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('empresas e invitados', () => {
    it('deja pasar a la empresa dueña del proceso', () => {
      expect(
        intentar({ role: UserRole.COMPANY, company: { id: EMPRESA_A } }),
      ).not.toThrow();
    });

    it('corta a la empresa de al lado', () => {
      expect(
        intentar({ role: UserRole.COMPANY, company: { id: EMPRESA_B } }),
      ).toThrow(ForbiddenException);
    });

    it('trata al invitado con el mismo recorte que a la empresa', () => {
      expect(intentar({ role: UserRole.GUEST, companyId: EMPRESA_A })).not.toThrow();
      expect(intentar({ role: UserRole.GUEST, companyId: EMPRESA_B })).toThrow(
        ForbiddenException,
      );
    });

    it('corta a la empresa que todavía no tiene empresa asignada', () => {
      expect(intentar({ role: UserRole.COMPANY })).toThrow(ForbiddenException);
    });
  });

  /**
   * Decisión explícita del 18-08-2026: el evaluador queda fuera del recorte
   * porque en producción ningún proceso tiene evaluadores asignados, y
   * exigirlo habría dejado a los 2 evaluadores sin poder abrir ningún test.
   *
   * Estas pruebas fijan esa decisión para que se vea que es deliberada. El día
   * que se cierre, son las que hay que dar vuelta.
   */
  describe('evaluadores (fuera del recorte, por ahora)', () => {
    it('deja pasar al evaluador asignado a ese proceso', () => {
      expect(intentar({ id: EVALUADOR, role: UserRole.EVALUATOR })).not.toThrow();
    });

    it('deja pasar también al evaluador NO asignado: es la brecha aceptada', () => {
      expect(intentar({ id: OTRO_EVALUADOR, role: UserRole.EVALUATOR })).not.toThrow();
    });

    it('deja pasar aunque el proceso no tenga ningún evaluador asignado', () => {
      expect(
        intentar(
          { id: EVALUADOR, role: UserRole.EVALUATOR },
          { ...POSTULACION, evaluadoresDelProceso: [] },
        ),
      ).not.toThrow();
    });
  });

  describe('Talentree', () => {
    it('pasa siempre', () => {
      expect(intentar({ id: 'quien-sea', role: UserRole.ADMIN_TALENTREE })).not.toThrow();
    });
  });

  describe('falla cerrada', () => {
    it('corta si no llega usuario', () => {
      expect(intentar(undefined)).toThrow(ForbiddenException);
      expect(intentar(null)).toThrow(ForbiddenException);
      expect(intentar({})).toThrow(ForbiddenException);
    });

    it('corta ante un rol que no conoce', () => {
      expect(intentar({ id: CANDIDATO, role: 'rol_inventado' })).toThrow(
        ForbiddenException,
      );
    });
  });
});
