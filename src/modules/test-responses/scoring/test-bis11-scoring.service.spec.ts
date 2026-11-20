import {
  TestBIS11ScoringService,
  nivelSubescalaBis11,
  nivelTotalBis11,
} from './test-bis11-scoring.service';
import { TestAnswer } from '../entities/test-answer.entity';
import {
  BIS11_INTERPRETACIONES,
  BIS11_ITEMS,
  BIS11_OPCIONES,
  BIS11_ALERTA_DESEABILIDAD,
  BIS11_UMBRAL_DESEABILIDAD,
} from '../../tests/shared/data/bis11.data';

/** Las opciones tal como las siembra el sembrador. */
const OPCIONES = Object.fromEntries(
  BIS11_OPCIONES.map((o) => [o.clave, o.texto]),
);

const RARAMENTE = 'Raramente o nunca';
const OCASIONALMENTE = 'Ocasionalmente';
const A_MENUDO = 'A menudo';
const SIEMPRE = 'Siempre o casi siempre';

const respuesta = (item: number, answer: unknown): TestAnswer =>
  ({
    answer,
    fixedTestQuestion: { questionNumber: item, options: OPCIONES },
  }) as unknown as TestAnswer;

const todas = (
  answer: (item: (typeof BIS11_ITEMS)[number]) => unknown,
): TestAnswer[] =>
  BIS11_ITEMS.map((item) => respuesta(item.numero, answer(item)));

const dimension = (
  r: ReturnType<TestBIS11ScoringService['calculateScore']>,
  clave: string,
) => r.interpretation.dimensiones.find((d) => d.clave === clave)!;

describe('TestBIS11ScoringService', () => {
  let servicio: TestBIS11ScoringService;

  beforeEach(() => {
    servicio = new TestBIS11ScoringService();
    jest.spyOn(servicio['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(servicio['logger'], 'error').mockImplementation(() => undefined);
    jest.spyOn(servicio['logger'], 'log').mockImplementation(() => undefined);
  });

  describe('la estructura del Excel', () => {
    it('8 ítems atencionales, 10 motores y 12 de no planificación', () => {
      const cuenta = (d: string) =>
        BIS11_ITEMS.filter((i) => i.dimension === d).length;
      expect(cuenta('ATENCIONAL')).toBe(8);
      expect(cuenta('MOTORA')).toBe(10);
      expect(cuenta('NO_PLANIFICACION')).toBe(12);
    });

    it('inversos: 1, 5, 6, 7, 8, 10, 11, 13, 17, 19, 22 y 30', () => {
      expect(BIS11_ITEMS.filter((i) => i.inverso).map((i) => i.numero)).toEqual(
        [1, 5, 6, 7, 8, 10, 11, 13, 17, 19, 22, 30],
      );
    });

    it('escala 1-2-3-4, la misma con la que se obtuvo la norma del total', () => {
      expect(BIS11_OPCIONES.map((o) => [o.texto, o.valor])).toEqual([
        [RARAMENTE, 1],
        [OCASIONALMENTE, 2],
        [A_MENUDO, 3],
        [SIEMPRE, 4],
      ]);
    });
  });

  describe('resultados predecibles', () => {
    it('todo «Raramente o nunca»: 20, 13, 33 y total 66 (Moderado)', () => {
      const r = servicio.calculateScore(todas(() => RARAMENTE));

      expect(r.rawScores).toEqual({
        atencional: 20,
        motora: 13,
        noPlanificacion: 33,
        total: 66,
      });
      expect(dimension(r, 'ATENCIONAL')).toMatchObject({
        minimo: 8,
        maximo: 32,
        nivel: 'Moderado',
      });
      expect(dimension(r, 'MOTORA')).toMatchObject({
        minimo: 10,
        maximo: 40,
        nivel: 'Bajo',
      });
      expect(dimension(r, 'NO_PLANIFICACION')).toMatchObject({
        minimo: 12,
        maximo: 48,
        nivel: 'Moderado',
      });
      expect(r.interpretation.total).toMatchObject({
        puntaje: 66,
        minimo: 30,
        maximo: 120,
        nivel: 'Moderado',
      });
      expect(r.interpretation.descripcion).toBe(
        BIS11_INTERPRETACIONES.TOTAL.Moderado,
      );
      expect(r.interpretation.resultadoResumen).toBe(
        'Puntaje total: 66/120 puntos — Nivel: Moderado',
      );
      expect(r.interpretation.alertaDeseabilidad).toBeNull();
    });

    it('todo «Ocasionalmente»: 20, 21, 31 y total 72 (Moderado)', () => {
      const r = servicio.calculateScore(todas(() => OCASIONALMENTE));
      expect(r.rawScores).toEqual({
        atencional: 20,
        motora: 21,
        noPlanificacion: 31,
        total: 72,
      });
      expect(dimension(r, 'MOTORA').nivel).toBe('Moderado');
      expect(r.interpretation.nivel).toBe('Moderado');
    });

    it('todo «A menudo»: 20, 29, 29 y total 78 (Alto)', () => {
      const r = servicio.calculateScore(todas(() => A_MENUDO));
      expect(r.rawScores).toEqual({
        atencional: 20,
        motora: 29,
        noPlanificacion: 29,
        total: 78,
      });
      expect(dimension(r, 'MOTORA').nivel).toBe('Moderado');
      expect(r.interpretation.nivel).toBe('Alto');
    });

    it('todo «Siempre o casi siempre»: 20, 37, 27 y total 84 (Alto)', () => {
      const r = servicio.calculateScore(todas(() => SIEMPRE));
      expect(r.rawScores).toEqual({
        atencional: 20,
        motora: 37,
        noPlanificacion: 27,
        total: 84,
      });
      expect(dimension(r, 'MOTORA').nivel).toBe('Alto');
      expect(r.interpretation.nivel).toBe('Alto');
    });

    it('impulsividad mínima: 8, 10, 12 y 30, todo Bajo y con alerta de deseabilidad', () => {
      const r = servicio.calculateScore(
        todas((item) => (item.inverso ? SIEMPRE : RARAMENTE)),
      );

      expect(r.rawScores).toEqual({
        atencional: 8,
        motora: 10,
        noPlanificacion: 12,
        total: 30,
      });
      for (const d of r.interpretation.dimensiones) {
        expect(d.nivel).toBe('Bajo');
        expect(d.interpretacion).toBe(
          BIS11_INTERPRETACIONES[d.clave as 'MOTORA'].Bajo,
        );
      }
      expect(r.interpretation.nivel).toBe('Bajo');
      expect(r.interpretation.alertaDeseabilidad).toBe(
        BIS11_ALERTA_DESEABILIDAD,
      );
      expect(r.interpretation.resultadoResumen).toBe(
        'Puntaje total: 30/120 puntos — Nivel: Bajo (posible deseabilidad social)',
      );
    });

    it('impulsividad máxima: 32, 40, 48 y 120, todo Alto', () => {
      const r = servicio.calculateScore(
        todas((item) => (item.inverso ? RARAMENTE : SIEMPRE)),
      );

      expect(r.rawScores).toEqual({
        atencional: 32,
        motora: 40,
        noPlanificacion: 48,
        total: 120,
      });
      expect(r.interpretation.dimensiones.map((d) => d.nivel)).toEqual([
        'Alto',
        'Alto',
        'Alto',
      ]);
      expect(r.interpretation.nivel).toBe('Alto');
      expect(r.interpretation.descripcion).toBe(
        BIS11_INTERPRETACIONES.TOTAL.Alto,
      );
      expect(r.interpretation.alertaDeseabilidad).toBeNull();
    });

    it('el puntaje corregido invierte solo los ítems inversos (5 - respuesta)', () => {
      const r = servicio.calculateScore(todas(() => OCASIONALMENTE));
      const item1 = r.interpretation.respuestas.find((x) => x.item === 1)!;
      const item2 = r.interpretation.respuestas.find((x) => x.item === 2)!;
      expect(item1).toMatchObject({
        valor: 2,
        inverso: true,
        puntajeCorregido: 3,
      });
      expect(item2).toMatchObject({
        valor: 2,
        inverso: false,
        puntajeCorregido: 2,
      });
    });
  });

  /** Respuestas dadas como una clave (A-D) por ítem, del 1 al 30. */
  const desde = (claves: string): TestAnswer[] =>
    [...claves].map((c, i) => respuesta(i + 1, c));

  /**
   * El reclamo del 20-11-2026: dos candidatos con respuestas distintas
   * recibieron el mismo informe. Son sus respuestas reales.
   */
  describe('respuestas reales de producción', () => {
    it('respuestas distintas dan totales distintos', () => {
      const a = servicio.calculateScore(desde('DAABDDDCACDABBAAAACAADBBAAABAD'));
      const b = servicio.calculateScore(desde('DABBDDDDBDDAAAAADADAADDDAAADAB'));
      expect(a.rawScores.total).toBe(43);
      expect(b.rawScores.total).toBe(47);
      expect(a.interpretation.nivel).toBe('Bajo');
      expect(b.interpretation.nivel).toBe('Bajo');
      expect(a.interpretation.alertaDeseabilidad).toBeNull();
      expect(b.interpretation.alertaDeseabilidad).toBeNull();
    });
  });

  describe('cortes', () => {
    it.each([
      [52, 'Bajo'],
      [53, 'Moderado'],
      [75, 'Moderado'],
      [76, 'Alto'],
    ])('total %p -> %s', (puntaje, nivel) => {
      expect(nivelTotalBis11(puntaje)).toBe(nivel);
    });

    it('la alerta de deseabilidad corta en media - 2 DT (41,24)', () => {
      expect(BIS11_UMBRAL_DESEABILIDAD).toBeCloseTo(41.24, 2);

      /** Parte del mínimo (30) y sube ítems directos hasta llegar a `n`. */
      const conTotal = (n: number) => {
        const claves: string[] = BIS11_ITEMS.map((i) => (i.inverso ? 'D' : 'A'));
        let falta = n - 30;
        BIS11_ITEMS.forEach((item, k) => {
          if (item.inverso || falta <= 0) return;
          const sube = Math.min(3, falta);
          claves[k] = 'ABCD'[sube];
          falta -= sube;
        });
        return servicio.calculateScore(desde(claves.join('')));
      };

      expect(conTotal(41).rawScores.total).toBe(41);
      expect(conTotal(41).interpretation.alertaDeseabilidad).not.toBeNull();
      expect(conTotal(42).interpretation.alertaDeseabilidad).toBeNull();
    });

    it.each([
      [16, 8, 32, 'Bajo'],
      [17, 8, 32, 'Moderado'],
      [24, 8, 32, 'Moderado'],
      [25, 8, 32, 'Alto'],
      [20, 10, 40, 'Bajo'],
      [21, 10, 40, 'Moderado'],
      [30, 10, 40, 'Moderado'],
      [31, 10, 40, 'Alto'],
      [24, 12, 48, 'Bajo'],
      [25, 12, 48, 'Moderado'],
      [36, 12, 48, 'Moderado'],
      [37, 12, 48, 'Alto'],
    ])('subescala %p (rango %p-%p) -> %s', (puntaje, minimo, maximo, nivel) => {
      expect(nivelSubescalaBis11(puntaje, minimo, maximo)).toBe(nivel);
    });
  });

  describe('formas en que puede llegar la respuesta', () => {
    it('acepta la clave', () => {
      expect(servicio.calculateScore(todas(() => 'A')).rawScores.total).toBe(
        66,
      );
    });

    it('acepta el texto en mayúsculas y con espacios', () => {
      expect(
        servicio.calculateScore(todas(() => '  SIEMPRE O CASI SIEMPRE '))
          .rawScores.total,
      ).toBe(84);
    });
  });

  describe('cuando no se puede calcular', () => {
    it('una respuesta ilegible no produce niveles', () => {
      const respuestas = todas(() => RARAMENTE);
      respuestas[9] = respuesta(10, 'Nunca jamás');

      const r = servicio.calculateScore(respuestas);
      expect(r.interpretation.nivel).toBe('NO_DETERMINADO');
      expect(r.interpretation.descripcion).toContain('29 de 30 ítems');
      expect(r.interpretation.dimensiones).toEqual([]);
      expect(r.interpretation.alertaDeseabilidad).toBeNull();
      expect(r.rawScores).toEqual({});
    });

    it('un número suelto no se adivina', () => {
      const r = servicio.calculateScore(todas(() => 3));
      expect(r.interpretation.nivel).toBe('NO_DETERMINADO');
    });
  });
});
