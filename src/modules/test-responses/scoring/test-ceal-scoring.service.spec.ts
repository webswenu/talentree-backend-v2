import {
  TestCEALScoringService,
  formatearEfectividadCeal,
  nivelDeEfectividadCeal,
} from './test-ceal-scoring.service';
import { TestAnswer } from '../entities/test-answer.entity';
import { CEAL_SITUACIONES, LetraCeal } from '../../tests/shared/data/ceal.data';
import { normalizarTexto } from './resolver-opcion';

/** Respuesta tal como la guarda el formulario: el TEXTO de la alternativa. */
const porTexto = (situacion: number, letra: LetraCeal): TestAnswer =>
  ({
    answer: CEAL_SITUACIONES[situacion - 1].alternativas[letra],
    fixedTestQuestion: {
      questionNumber: situacion,
      options: { ...CEAL_SITUACIONES[situacion - 1].alternativas },
    },
  }) as unknown as TestAnswer;

/** Una hoja completa: una letra por situación, en orden. */
const hoja = (letras: string): TestAnswer[] =>
  [...letras].map((letra, i) => porTexto(i + 1, letra as LetraCeal));

const estilo = (
  r: ReturnType<TestCEALScoringService['calculateScore']>,
  n: number,
) => r.interpretation.estilos.find((e) => e.numero === n)!;

describe('TestCEALScoringService', () => {
  let servicio: TestCEALScoringService;

  beforeEach(() => {
    servicio = new TestCEALScoringService();
    jest.spyOn(servicio['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(servicio['logger'], 'error').mockImplementation(() => undefined);
    jest.spyOn(servicio['logger'], 'log').mockImplementation(() => undefined);
  });

  describe('la clave del documento', () => {
    it('en cada situación, cada letra es un estilo distinto y una efectividad distinta', () => {
      for (const s of CEAL_SITUACIONES) {
        const estilos = Object.values(s.clave)
          .map((c) => c.estilo)
          .sort();
        const efectividades = Object.values(s.clave)
          .map((c) => c.efectividad)
          .sort((a, b) => a - b);
        expect(estilos).toEqual([1, 2, 3, 4]);
        expect(efectividades).toEqual([-2, -1, 1, 2]);
      }
    });

    it('«lo teórico es que hayan 3 respuestas por estilo»: cada estilo es el óptimo en 3 situaciones', () => {
      const optimos = CEAL_SITUACIONES.map(
        (s) => Object.values(s.clave).find((c) => c.efectividad === 2)!.estilo,
      );
      for (const n of [1, 2, 3, 4]) {
        expect(optimos.filter((o) => o === n)).toHaveLength(3);
      }
    });

    it('las cuatro alternativas de cada situación se distinguen por su texto', () => {
      for (const s of CEAL_SITUACIONES) {
        const textos = new Set(
          Object.values(s.alternativas).map(normalizarTexto),
        );
        expect(textos.size).toBe(4);
      }
    });

    it('el ejemplo de la pauta: C en la situación 1 va a la tercera fila de la primera columna', () => {
      const r = servicio.calculateScore(hoja('CAAAAAAAAAAA'));
      expect(r.interpretation.respuestas[0]).toEqual({
        situacion: 1,
        alternativa: 'C',
        estilo: 2,
        efectividad: 1,
      });
    });
  });

  describe('resultados predecibles', () => {
    it('la hoja ideal da 3 respuestas por estilo, todas +2, y efectividad +24', () => {
      const r = servicio.calculateScore(hoja('AADCCDBACDBB'));

      for (const n of [1, 2, 3, 4]) {
        expect(estilo(r, n).predominio).toBe(3);
        expect(estilo(r, n).efectividad).toBe(24);
        expect(estilo(r, n).nivelEfectividad).toBe('MUY ALTA');
        expect(estilo(r, n).percepcion?.tipo).toBe('EFICAZ');
      }
      expect(r.interpretation.efectividadGeneral).toEqual({
        puntaje: 24,
        nivel: 'MUY ALTA',
      });
      expect(r.interpretation.nivel).toBe('MUY ALTA');
      expect(r.interpretation.estilosPredominantes).toEqual([
        'Autocrático',
        'Integrado',
        'Relacionado',
        'Separado',
      ]);
    });

    it('todo A: 3 por estilo, efectividades -8, +8, +4, -8 y general -1', () => {
      const r = servicio.calculateScore(hoja('AAAAAAAAAAAA'));

      expect(r.rawScores).toEqual({
        autocratico: 3,
        integrado: 3,
        relacionado: 3,
        separado: 3,
        efectividadGeneral: -1,
      });
      expect(r.scaledScores).toEqual({
        autocratico: -8,
        integrado: 8,
        relacionado: 4,
        separado: -8,
        efectividadGeneral: -1,
      });
      expect(estilo(r, 1).nivelEfectividad).toBe('BAJA');
      expect(estilo(r, 2).nivelEfectividad).toBe('ALTA');
      expect(estilo(r, 3).nivelEfectividad).toBe('PROMEDIO ALTO');
      expect(estilo(r, 1).percepcion).toMatchObject({
        tipo: 'INEFICAZ',
        nombre: 'AUTORITARIO',
      });
      expect(estilo(r, 2).percepcion).toMatchObject({
        tipo: 'EFICAZ',
        nombre: 'EJECUTIVO',
      });
      expect(estilo(r, 3).percepcion).toMatchObject({
        tipo: 'EFICAZ',
        nombre: 'PROMOTOR',
      });
      expect(estilo(r, 4).percepcion).toMatchObject({
        tipo: 'INEFICAZ',
        nombre: 'DESERTOR',
      });
      expect(r.interpretation.efectividadGeneral).toEqual({
        puntaje: -1,
        nivel: 'PROMEDIO',
      });
    });

    it('todo C: la eficacia de un estilo puede ser decimal y se clasifica redondeando', () => {
      const r = servicio.calculateScore(hoja('CCCCCCCCCCCC'));

      // Autocrático: 5 respuestas que suman -2 -> -2 / 5 × 12 = -4,8 -> PROMEDIO BAJO
      expect(estilo(r, 1).predominio).toBe(5);
      expect(estilo(r, 1).efectividadSituacional).toBe(-2);
      expect(estilo(r, 1).efectividad).toBe(-4.8);
      expect(estilo(r, 1).nivelEfectividad).toBe('PROMEDIO BAJO');
      expect(r.interpretation.estilosPredominantes).toEqual(['Autocrático']);
      expect(r.interpretation.efectividadGeneral).toEqual({
        puntaje: -3,
        nivel: 'PROMEDIO MENOS',
      });
    });

    it('un estilo que nunca se eligió no tiene efectividad ni percepción', () => {
      // La letra que corresponde al estilo 1 en cada situación.
      const r = servicio.calculateScore(hoja('ADCBCBACCBAC'));

      expect(estilo(r, 1).predominio).toBe(12);
      expect(estilo(r, 1).efectividad).toBe(-8);
      for (const n of [2, 3, 4]) {
        expect(estilo(r, n).predominio).toBe(0);
        expect(estilo(r, n).efectividad).toBeNull();
        expect(estilo(r, n).nivelEfectividad).toBeNull();
        expect(estilo(r, n).percepcion).toBeNull();
      }
      expect(r.scaledScores).toEqual({
        autocratico: -8,
        efectividadGeneral: -8,
      });
    });

    it('efectividad cero no se caracteriza como eficaz ni ineficaz', () => {
      // Todo D: el Separado suma 0 en sus 3 respuestas.
      const r = servicio.calculateScore(hoja('DDDDDDDDDDDD'));
      expect(estilo(r, 4).efectividad).toBe(0);
      expect(estilo(r, 4).percepcion).toBeNull();
    });
  });

  describe('formas en que puede llegar la respuesta', () => {
    it('acepta la letra', () => {
      const respuestas = hoja('AADCCDBACDBB').map((a, i) => ({
        ...a,
        answer: 'AADCCDBACDBB'[i],
      })) as TestAnswer[];
      expect(
        servicio.calculateScore(respuestas).interpretation.efectividadGeneral
          ?.puntaje,
      ).toBe(24);
    });

    it('acepta el texto con mayúsculas, sin tildes y con espacios de más', () => {
      const respuestas = hoja('AADCCDBACDBB').map((a) => ({
        ...a,
        answer: `  ${normalizarTexto(String(a.answer)).toUpperCase()}  `,
      })) as TestAnswer[];
      expect(
        servicio.calculateScore(respuestas).interpretation.efectividadGeneral
          ?.puntaje,
      ).toBe(24);
    });
  });

  describe('cuando no se puede calcular', () => {
    it('una respuesta ilegible no produce un perfil', () => {
      const respuestas = hoja('AADCCDBACDBB');
      respuestas[4] = {
        ...respuestas[4],
        answer: 'algo que no es una alternativa',
      } as TestAnswer;

      const r = servicio.calculateScore(respuestas);
      expect(r.interpretation.nivel).toBe('NO_DETERMINADO');
      expect(r.interpretation.descripcion).toContain('11 de 12 situaciones');
      expect(r.interpretation.estilos).toEqual([]);
      expect(r.rawScores).toEqual({});
    });

    it('faltar una situación tampoco', () => {
      const r = servicio.calculateScore(hoja('AADCCDBACDB'));
      expect(r.interpretation.nivel).toBe('NO_DETERMINADO');
    });
  });

  describe('tabla de efectividades', () => {
    it.each([
      [-24, 'MUY BAJA'],
      [-13, 'MUY BAJA'],
      [-12, 'BAJA'],
      [-8, 'BAJA'],
      [-7.5, 'BAJA'],
      [-7, 'PROMEDIO BAJO'],
      [-4, 'PROMEDIO BAJO'],
      [-3, 'PROMEDIO MENOS'],
      [-2, 'PROMEDIO MENOS'],
      [-1, 'PROMEDIO'],
      [0, 'PROMEDIO'],
      [1, 'PROMEDIO'],
      [2, 'PROMEDIO MAS'],
      [3, 'PROMEDIO MAS'],
      [3.4, 'PROMEDIO MAS'],
      [4, 'PROMEDIO ALTO'],
      [7, 'PROMEDIO ALTO'],
      [7.2, 'PROMEDIO ALTO'],
      [8, 'ALTA'],
      [12, 'ALTA'],
      [13, 'MUY ALTA'],
      [24, 'MUY ALTA'],
    ])('%p -> %s', (valor, nivel) => {
      expect(nivelDeEfectividadCeal(valor)).toBe(nivel);
    });

    it('formatea con signo y coma decimal', () => {
      expect(formatearEfectividadCeal(10)).toBe('+10');
      expect(formatearEfectividadCeal(-3)).toBe('-3');
      expect(formatearEfectividadCeal(0)).toBe('0');
      expect(formatearEfectividadCeal(7.2)).toBe('+7,20');
    });
  });
});
