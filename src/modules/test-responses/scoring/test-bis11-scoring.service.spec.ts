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

    it('escala 0-1-3-4', () => {
      expect(BIS11_OPCIONES.map((o) => [o.texto, o.valor])).toEqual([
        [RARAMENTE, 0],
        [OCASIONALMENTE, 1],
        [A_MENUDO, 3],
        [SIEMPRE, 4],
      ]);
    });
  });

  describe('resultados predecibles', () => {
    it('todo «Raramente o nunca»: 16, 4, 28 y total 48 (Bajo)', () => {
      const r = servicio.calculateScore(todas(() => RARAMENTE));

      expect(r.rawScores).toEqual({
        atencional: 16,
        motora: 4,
        noPlanificacion: 28,
        total: 48,
      });
      expect(dimension(r, 'ATENCIONAL')).toMatchObject({
        maximo: 32,
        nivel: 'Moderado',
      });
      expect(dimension(r, 'MOTORA')).toMatchObject({
        maximo: 40,
        nivel: 'Bajo',
      });
      expect(dimension(r, 'NO_PLANIFICACION')).toMatchObject({
        maximo: 48,
        nivel: 'Moderado',
      });
      expect(r.interpretation.total).toMatchObject({
        puntaje: 48,
        maximo: 120,
        nivel: 'Bajo',
      });
      expect(r.interpretation.nivel).toBe('Bajo');
      expect(r.interpretation.descripcion).toBe(
        BIS11_INTERPRETACIONES.TOTAL.Bajo,
      );
      expect(r.interpretation.resultadoResumen).toBe(
        'Puntaje total: 48/120 puntos — Nivel: Bajo',
      );
    });

    it('todo «Ocasionalmente»: 16, 12, 26 y total 54 (Moderado)', () => {
      const r = servicio.calculateScore(todas(() => OCASIONALMENTE));
      expect(r.rawScores).toEqual({
        atencional: 16,
        motora: 12,
        noPlanificacion: 26,
        total: 54,
      });
      expect(dimension(r, 'MOTORA').nivel).toBe('Bajo');
      expect(r.interpretation.nivel).toBe('Moderado');
    });

    it('todo «A menudo»: 16, 28, 22 y total 66 (Moderado)', () => {
      const r = servicio.calculateScore(todas(() => A_MENUDO));
      expect(r.rawScores).toEqual({
        atencional: 16,
        motora: 28,
        noPlanificacion: 22,
        total: 66,
      });
      expect(dimension(r, 'MOTORA').nivel).toBe('Alto');
      expect(r.interpretation.nivel).toBe('Moderado');
    });

    it('todo «Siempre o casi siempre»: 16, 36, 20 y total 72 (Moderado)', () => {
      const r = servicio.calculateScore(todas(() => SIEMPRE));
      expect(r.rawScores).toEqual({
        atencional: 16,
        motora: 36,
        noPlanificacion: 20,
        total: 72,
      });
      expect(r.interpretation.nivel).toBe('Moderado');
    });

    it('impulsividad mínima: todo en cero lleva nivel Bajo y su texto (no queda vacío como en la planilla)', () => {
      const r = servicio.calculateScore(
        todas((item) => (item.inverso ? SIEMPRE : RARAMENTE)),
      );

      expect(r.rawScores).toEqual({
        atencional: 0,
        motora: 0,
        noPlanificacion: 0,
        total: 0,
      });
      for (const d of r.interpretation.dimensiones) {
        expect(d.nivel).toBe('Bajo');
        expect(d.interpretacion).toBe(
          BIS11_INTERPRETACIONES[d.clave as 'MOTORA'].Bajo,
        );
      }
      expect(r.interpretation.nivel).toBe('Bajo');
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
    });

    it('el puntaje corregido invierte solo los ítems inversos', () => {
      const r = servicio.calculateScore(todas(() => OCASIONALMENTE));
      const item1 = r.interpretation.respuestas.find((x) => x.item === 1)!;
      const item2 = r.interpretation.respuestas.find((x) => x.item === 2)!;
      expect(item1).toMatchObject({
        valor: 1,
        inverso: true,
        puntajeCorregido: 3,
      });
      expect(item2).toMatchObject({
        valor: 1,
        inverso: false,
        puntajeCorregido: 1,
      });
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

    it.each([
      [10, 32, 'Bajo'],
      [11, 32, 'Moderado'],
      [21, 32, 'Moderado'],
      [22, 32, 'Alto'],
      [13, 40, 'Bajo'],
      [14, 40, 'Moderado'],
      [26, 40, 'Moderado'],
      [27, 40, 'Alto'],
      [16, 48, 'Bajo'],
      [17, 48, 'Moderado'],
      [32, 48, 'Moderado'],
      [33, 48, 'Alto'],
    ])('subescala %p de %p -> %s', (puntaje, maximo, nivel) => {
      expect(nivelSubescalaBis11(puntaje, maximo)).toBe(nivel);
    });
  });

  describe('formas en que puede llegar la respuesta', () => {
    it('acepta la clave', () => {
      expect(servicio.calculateScore(todas(() => 'A')).rawScores.total).toBe(
        48,
      );
    });

    it('acepta el texto en mayúsculas y con espacios', () => {
      expect(
        servicio.calculateScore(todas(() => '  SIEMPRE O CASI SIEMPRE '))
          .rawScores.total,
      ).toBe(72);
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
      expect(r.rawScores).toEqual({});
    });

    it('un número suelto no se adivina', () => {
      const r = servicio.calculateScore(todas(() => 3));
      expect(r.interpretation.nivel).toBe('NO_DETERMINADO');
    });
  });
});
