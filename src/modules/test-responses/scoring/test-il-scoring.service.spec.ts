import { TestILScoringService } from './test-il-scoring.service';
import { TestAnswer } from '../entities/test-answer.entity';

/** La pregunta 1 real del test sembrado. */
const OPCIONES = {
  A: '30 minutos',
  B: '40 minutos',
  C: '50 minutos',
  D: '60 minutos',
};

const pregunta = (n: number, respuesta: unknown, correcta = 'C'): TestAnswer =>
  ({
    answer: respuesta,
    fixedTestQuestion: {
      questionNumber: n,
      options: OPCIONES,
      correctAnswer: { answer: correcta },
    },
  }) as unknown as TestAnswer;

const repetir = (veces: number, respuesta: unknown): TestAnswer[] =>
  Array.from({ length: veces }, (_, i) => pregunta(i + 1, respuesta));

describe('TestILScoringService', () => {
  let servicio: TestILScoringService;

  beforeEach(() => {
    servicio = new TestILScoringService();
    jest.spyOn(servicio['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(servicio['logger'], 'error').mockImplementation(() => undefined);
    jest.spyOn(servicio['logger'], 'log').mockImplementation(() => undefined);
  });

  describe('el defecto que se corrigió', () => {
    /**
     * Reproduce lo verificado en producción el 19-08-2026: se respondieron las
     * 20 correctas y el resultado fue 0/20 con dictamen «nivel BAJO». El
     * formulario envía el TEXTO de la opción y el puntuador comparaba contra la
     * LETRA guardada, así que nunca coincidían.
     */
    it('cuenta correctas cuando la respuesta llega como TEXTO de la opción', () => {
      const r = servicio.calculateScore(repetir(20, '50 minutos'));

      expect(r.rawScores.total).toBe(20);
      expect(r.scaledScores.percentage).toBe(100);
      expect(r.interpretation.nivel).toBe('ALTO');
    });

    it('ya no dice «BAJO» a quien respondió todo bien', () => {
      const r = servicio.calculateScore(repetir(20, '50 minutos'));

      expect(r.interpretation.nivel).not.toBe('BAJO');
      expect(r.interpretation.descripcion).not.toContain('Dificultad para resolver');
    });
  });

  describe('formas en que puede llegar la respuesta', () => {
    it('acepta la letra', () => {
      expect(servicio.calculateScore(repetir(20, 'C')).rawScores.total).toBe(20);
    });

    it('acepta la letra en minúscula', () => {
      expect(servicio.calculateScore(repetir(20, 'c')).rawScores.total).toBe(20);
    });

    it('acepta el texto con espacios de más', () => {
      expect(servicio.calculateScore(repetir(20, '  50 minutos ')).rawScores.total).toBe(20);
    });

    it('acepta la respuesta envuelta en un objeto', () => {
      expect(servicio.calculateScore(repetir(20, { value: 'C' })).rawScores.total).toBe(20);
    });
  });

  describe('respuestas equivocadas siguen siendo equivocadas', () => {
    it('no cuenta la opción incorrecta por texto', () => {
      expect(servicio.calculateScore(repetir(20, '30 minutos')).rawScores.total).toBe(0);
    });

    it('no cuenta la opción incorrecta por letra', () => {
      expect(servicio.calculateScore(repetir(20, 'A')).rawScores.total).toBe(0);
    });

    it('cuenta bien una mezcla', () => {
      const respuestas = [
        ...repetir(12, '50 minutos'), // correctas
        ...repetir(8, 'A'), // incorrectas
      ];

      const r = servicio.calculateScore(respuestas);

      expect(r.rawScores.total).toBe(12);
      expect(r.interpretation.nivel).toBe('MEDIO');
    });
  });

  describe('cuando no se puede leer nada', () => {
    it('no informa «BAJO» sino que avisa que no se pudo calcular', () => {
      const r = servicio.calculateScore(repetir(20, 'una respuesta que no existe'));

      expect(r.interpretation.nivel).toBe('NO_DETERMINADO');
      expect(r.interpretation.descripcion).toContain('NO refleja la capacidad de la persona');
      expect(r.interpretation.capacidades).toEqual([]);
    });

    it('tampoco con respuestas nulas o de otro tipo', () => {
      const r = servicio.calculateScore([
        pregunta(1, null),
        pregunta(2, undefined),
        pregunta(3, []),
      ]);

      expect(r.interpretation.nivel).toBe('NO_DETERMINADO');
    });

    it('un cero legítimo SÍ se informa como BAJO', () => {
      // Respondió, se entendió, y estuvo todo mal: eso sí es un nivel bajo.
      const r = servicio.calculateScore(repetir(20, '30 minutos'));

      expect(r.rawScores.total).toBe(0);
      expect(r.interpretation.nivel).toBe('BAJO');
    });
  });
});
