import { TestDISCScoringService } from './test-disc-scoring.service';
import { TestAnswer } from '../entities/test-answer.entity';

/**
 * El bloque 1 real del test sembrado: la dimensión es la CLAVE y la palabra el
 * valor. Ahí estaba el malentendido que dejaba todos los puntajes en cero.
 */
const OPCIONES_BLOQUE = {
  words: { D: 'Decidido', I: 'Alegre', S: 'Paciente', C: 'Preciso' },
  format: 'mas_menos',
};

const bloque = (numero: number, respuesta: unknown): TestAnswer =>
  ({
    answer: respuesta,
    fixedTestQuestion: { questionNumber: numero, options: OPCIONES_BLOQUE },
  }) as unknown as TestAnswer;

const repetir = (veces: number, respuesta: unknown): TestAnswer[] =>
  Array.from({ length: veces }, (_, i) => bloque(i + 1, respuesta));

describe('TestDISCScoringService', () => {
  let servicio: TestDISCScoringService;

  beforeEach(() => {
    servicio = new TestDISCScoringService();
    // El servicio registra advertencias esperadas en los casos degradados.
    jest.spyOn(servicio['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(servicio['logger'], 'error').mockImplementation(() => undefined);
    jest.spyOn(servicio['logger'], 'log').mockImplementation(() => undefined);
  });

  describe('formas de respuesta que sí se pueden puntuar', () => {
    it('puntúa la forma canónica, con las palabras elegidas', () => {
      const respuestas = repetir(24, { mas: 'Decidido', menos: 'Paciente' });

      const { rawScores } = servicio.calculateScore(respuestas);

      expect(rawScores).toEqual({ D: 24, I: 0, S: -24, C: 0 });
    });

    it('puntúa también si vienen los códigos de dimensión', () => {
      const respuestas = repetir(24, { mas: 'C', menos: 'I' });

      const { rawScores } = servicio.calculateScore(respuestas);

      expect(rawScores).toEqual({ D: 0, I: -24, S: 0, C: 24 });
    });

    it('recupera las respuestas ya guardadas por el formulario antiguo', () => {
      // Forma antigua: la palabra es la clave. Solo se acepta cuando hay
      // exactamente una marcada como MÁS y una como MENOS.
      const respuestas = repetir(24, { Decidido: 'mas', Preciso: 'menos' });

      const { rawScores } = servicio.calculateScore(respuestas);

      expect(rawScores).toEqual({ D: 24, I: 0, S: 0, C: -24 });
    });
  });

  describe('el defecto que se corrigió', () => {
    /**
     * Reproduce exactamente lo que pasó en producción el 18-08-2026: el
     * formulario permitía marcar las cuatro palabras, se guardaban con la
     * palabra como clave, el servicio no las entendía y aun así se emitía un
     * perfil «DOMINANTE» con una descripción de personalidad completa.
     */
    const RESPUESTA_DE_PRODUCCION = {
      Preciso: 'mas',
      Decidido: 'menos',
      Alegre: 'mas',
      Paciente: 'menos',
    };

    it('no inventa un perfil cuando ninguna respuesta es interpretable', () => {
      const resultado = servicio.calculateScore(
        repetir(24, RESPUESTA_DE_PRODUCCION),
      );

      expect(resultado.interpretation.perfilPredominante).toBe('No determinado');
      expect(resultado.interpretation.descripcion).toContain(
        'No fue posible calcular el perfil DISC',
      );
      expect(resultado.interpretation.fortalezas).toEqual([]);
    });

    it('nunca vuelve a decir «DOMINANTE» sin haber contado una sola respuesta', () => {
      const resultado = servicio.calculateScore(
        repetir(24, RESPUESTA_DE_PRODUCCION),
      );

      expect(resultado.interpretation.descripcion).not.toContain('DOMINANTE');
      expect(resultado.interpretation.perfilCombinado).not.toBe('DI');
    });

    it('no reparte un 25 % plano, que se lee como un perfil equilibrado medido', () => {
      const resultado = servicio.calculateScore(
        repetir(24, RESPUESTA_DE_PRODUCCION),
      );

      expect(resultado.scaledScores).toEqual({ D: 0, I: 0, S: 0, C: 0 });
    });
  });

  describe('casos degradados', () => {
    it('descarta un bloque sin selección y no lo cuenta', () => {
      const respuestas = [
        ...repetir(23, { mas: 'Decidido', menos: 'Paciente' }),
        bloque(24, { mas: 'Decidido' }), // falta MENOS
      ];

      const { rawScores } = servicio.calculateScore(respuestas);

      expect(rawScores).toEqual({ D: 23, I: 0, S: -23, C: 0 });
    });

    it('no interpreta respuestas nulas ni de otro tipo', () => {
      const resultado = servicio.calculateScore([
        bloque(1, null),
        bloque(2, 'texto suelto'),
        bloque(3, undefined),
      ]);

      expect(resultado.interpretation.perfilPredominante).toBe('No determinado');
    });
  });

  describe('empates', () => {
    it('nombra el empate en vez de romperlo con el orden de las llaves', () => {
      // 12 bloques suman a D y restan a S; los otros 12 hacen lo contrario.
      const respuestas = [
        ...repetir(12, { mas: 'Decidido', menos: 'Paciente' }),
        ...repetir(12, { mas: 'Paciente', menos: 'Decidido' }),
      ];

      const resultado = servicio.calculateScore(respuestas);

      expect(resultado.rawScores).toEqual({ D: 0, I: 0, S: 0, C: 0 });
      expect(resultado.interpretation.perfilPredominante).toBe('Equilibrado');
      expect(resultado.interpretation.descripcion).not.toContain('DOMINANTE');
    });

    it('sí determina un predominante cuando lo hay', () => {
      const respuestas = [
        ...repetir(20, { mas: 'Alegre', menos: 'Preciso' }),
        ...repetir(4, { mas: 'Decidido', menos: 'Paciente' }),
      ];

      const resultado = servicio.calculateScore(respuestas);

      expect(resultado.interpretation.perfilPredominante).toBe('I');
      expect(resultado.interpretation.descripcion).toContain('INFLUYENTE');
    });
  });
});
