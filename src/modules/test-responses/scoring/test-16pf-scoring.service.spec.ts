import { Test16PFScoringService } from './test-16pf-scoring.service';
import { TestAnswer } from '../entities/test-answer.entity';

/**
 * Lo que fijan estas pruebas, verificado contra produccion el 19-08-2026.
 *
 * Las dos respuestas de 16PF que existen quedaron con los 16 factores en cero
 * y los decatipos en 1 (el piso de la escala), y el dictamen guardado declara
 * a las dos personas "muy bajo" en las 16 dimensiones. No respondieron asi:
 * una contesto "Termino Medio" 50 veces y la otra "No" 75 veces.
 *
 * La causa fue que el front manda el TEXTO de la opcion y el mapa de puntajes
 * esta indexado por LETRA. El respaldo por texto se agrego el 11-12-2025
 * (commit a18b4a6), y las dos respuestas se puntuaron antes: el 19-11-2025 y
 * el 10-12-2025.
 */
describe('Test16PFScoringService · resolucion de la respuesta', () => {
  let servicio: Test16PFScoringService;

  beforeEach(() => {
    servicio = new Test16PFScoringService();
    // El servicio avisa por log de cada respuesta que no entiende; en las
    // pruebas eso solo ensucia la salida.
    jest.spyOn(servicio['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(servicio['logger'], 'log').mockImplementation(() => undefined);
    jest.spyOn(servicio['logger'], 'error').mockImplementation(() => undefined);
  });

  /** Arma una respuesta con la forma que tiene en produccion. */
  const respuesta = (
    factor: string,
    answer: unknown,
    opciones: Record<string, unknown> = {
      A: 'Si',
      B: 'Termino Medio',
      C: 'No',
      scoring: { A: 0, B: 1, C: 2 },
    },
  ): TestAnswer =>
    ({
      answer,
      fixedTestQuestion: {
        questionNumber: 1,
        factor,
        options: opciones,
      },
    }) as unknown as TestAnswer;

  describe('formas en que puede llegar la respuesta', () => {
    it('la letra, que es lo que el puntuador siempre supo leer', () => {
      const r = servicio.calculateScore([respuesta('A', 'C')]);

      expect(r.rawScores.A).toBe(2);
    });

    it('el texto de la opcion, que es lo que el front manda de verdad', () => {
      const r = servicio.calculateScore([respuesta('A', 'Termino Medio')]);

      expect(r.rawScores.A).toBe(1);
    });

    it('el texto con tilde contra una opcion sin tilde', () => {
      // En produccion hay respuestas guardadas como "Termino medio" con tilde.
      const r = servicio.calculateScore([respuesta('A', 'Término medio')]);

      expect(r.rawScores.A).toBe(1);
    });

    it('una opcion sembrada con espacio al final', () => {
      // Cuatro preguntas del test tienen la opcion A guardada como "Si ".
      const opciones = {
        A: 'Si ',
        B: 'Termino Medio',
        C: 'No',
        scoring: { A: 0, B: 1, C: 2 },
      };
      const r = servicio.calculateScore([respuesta('A', 'Si', opciones)]);

      // Resuelve, y ademas cuenta: el puntaje de A es 0 y eso es un dato valido.
      expect(r.rawScores.A).toBe(0);
      expect(r.interpretation.resumenGlobal).not.toContain('No fue posible calcular');
    });

    it('envuelta en un objeto con value', () => {
      const r = servicio.calculateScore([respuesta('A', { value: 'No' })]);

      expect(r.rawScores.A).toBe(2);
    });
  });

  describe('cuando no se puede interpretar nada', () => {
    it('no emite dictamen en vez de declarar a la persona "muy bajo" en todo', () => {
      const basura = [
        respuesta('A', 'XOOO'),
        respuesta('B', 'pq'),
        respuesta('C', '3/11'),
      ];

      const r = servicio.calculateScore(basura);

      expect(r.interpretation.resumenGlobal).toContain('No fue posible calcular');
      expect(r.interpretation.resumenGlobal).toContain('no debe usarse');
      // Lo que hacia antes: describir cada factor como muy bajo.
      expect(r.interpretation.resumenGlobal).not.toContain('muy bajo');
      expect(r.scaledScores.A).toBe(0);
    });

    it('una sola respuesta valida ya alcanza para puntuar', () => {
      const r = servicio.calculateScore([respuesta('A', 'No'), respuesta('B', 'XOOO')]);

      expect(r.interpretation.resumenGlobal).not.toContain('No fue posible calcular');
      expect(r.rawScores.A).toBe(2);
    });

    it('un cero legitimo no se confunde con una respuesta ilegible', () => {
      // La opcion "Si" vale 0. Si el cero se tomara como fallo, un candidato
      // que contesta "Si" a todo caeria en el resultado no calculable.
      const todoSi = ['A', 'B', 'C'].map((f) => respuesta(f, 'Si'));

      const r = servicio.calculateScore(todoSi);

      expect(r.interpretation.resumenGlobal).not.toContain('No fue posible calcular');
      expect(r.rawScores.A).toBe(0);
    });
  });
});
