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

describe('Test16PFScoringService · el test completo, de principio a fin', () => {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const preguntas: any[] = require('../../../database/seeders/data/16pf-questions.json');

  let servicio: Test16PFScoringService;

  beforeEach(() => {
    servicio = new Test16PFScoringService();
    jest.spyOn(servicio['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(servicio['logger'], 'log').mockImplementation(() => undefined);
    jest.spyOn(servicio['logger'], 'error').mockImplementation(() => undefined);
  });

  const RAZONAMIENTO: Record<number, string> = servicio_ITEMS();
  function servicio_ITEMS(): Record<number, string> {
    const s = new Test16PFScoringService();
    return (s as any).ITEMS_DE_RAZONAMIENTO;
  }

  /** Arma las 187 respuestas eligiendo, en cada pregunta, la letra que se pida. */
  const rendirTest = (elegir: (q: any) => 'A' | 'B' | 'C'): any[] =>
    preguntas.map((q) => {
      const letra = elegir(q);
      return {
        answer: q.options[letra], // el front manda el TEXTO, como en produccion
        fixedTestQuestion: {
          questionNumber: q.questionNumber,
          factor: q.factor,
          options: q.options,
        },
      };
    });

  it('el cuestionario tiene 187 preguntas', () => {
    expect(preguntas).toHaveLength(187);
  });

  it('las 13 de razonamiento existen y su respuesta correcta es una opcion real', () => {
    for (const [numero, letra] of Object.entries(RAZONAMIENTO)) {
      const q = preguntas.find((x) => x.questionNumber === Number(numero));
      expect(q).toBeDefined();
      expect(q.options[letra]).toBeDefined();
    }
  });

  it('quien acierta las 13 de razonamiento saca 13 en B; quien las falla, 0', () => {
    const todasBien = servicio.calculateScore(
      rendirTest((q) => (RAZONAMIENTO[q.questionNumber] as any) ?? 'B'),
    );
    expect(todasBien.rawScores.B).toBe(13);

    // Elegir a proposito una letra distinta de la correcta en cada una.
    const todasMal = servicio.calculateScore(
      rendirTest((q) => {
        const ok = RAZONAMIENTO[q.questionNumber];
        if (!ok) return 'B';
        return (ok === 'A' ? 'C' : 'A') as any;
      }),
    );
    expect(todasMal.rawScores.B).toBe(0);
  });

  it('acertar nunca puntua menos que fallar, que era el defecto', () => {
    const bien = servicio.calculateScore(
      rendirTest((q) => (RAZONAMIENTO[q.questionNumber] as any) ?? 'B'),
    );
    const mal = servicio.calculateScore(
      rendirTest((q) => {
        const ok = RAZONAMIENTO[q.questionNumber];
        if (!ok) return 'B';
        return (ok === 'A' ? 'C' : 'A') as any;
      }),
    );
    expect(bien.scaledScores.B).toBeGreaterThan(mal.scaledScores.B);
  });

  it('B lleva SOLO los items de razonamiento: su maximo es 13, no mas', () => {
    // Contestando la opcion que mas puntua en todo, B no puede pasar de 13.
    const todoC = servicio.calculateScore(rendirTest(() => 'C'));
    expect(todoC.rawScores.B).toBeLessThanOrEqual(13);
  });

  it('quien contesta el punto medio en todo queda cerca del centro de la escala', () => {
    // Con la opcion B (valor 1 de 2) en las 187, el bruto de cada factor de
    // personalidad es la mitad del maximo, que es justo la media asumida:
    // el decatipo tiene que dar 5 o 6, no el piso ni el techo.
    const medio = servicio.calculateScore(rendirTest(() => 'B'));
    const personalidad = Object.keys(medio.scaledScores).filter((f) => f !== 'B');

    for (const f of personalidad) {
      expect(medio.scaledScores[f]).toBeGreaterThanOrEqual(5);
      expect(medio.scaledScores[f]).toBeLessThanOrEqual(6);
    }
  });

  it('los extremos llegan a los extremos, y no se salen de 1..10', () => {
    const todoA = servicio.calculateScore(rendirTest(() => 'A'));
    const todoC = servicio.calculateScore(rendirTest(() => 'C'));
    const personalidad = Object.keys(todoA.scaledScores).filter((f) => f !== 'B');

    for (const f of personalidad) {
      expect(todoA.scaledScores[f]).toBe(1);
      expect(todoC.scaledScores[f]).toBe(10);
    }
  });

  it('el resultado sale completo: 16 factores, decatipos e interpretacion', () => {
    const r = servicio.calculateScore(rendirTest(() => 'B'));

    expect(Object.keys(r.rawScores)).toHaveLength(16);
    expect(Object.keys(r.scaledScores)).toHaveLength(16);
    expect(Object.keys(r.interpretation.factorDescriptions)).toHaveLength(16);
    expect(r.interpretation.resumenGlobal).toBeTruthy();
    // Ningun factor puede quedar sin descripcion legible.
    for (const f of Object.keys(r.interpretation.factorDescriptions)) {
      expect(r.interpretation.factorDescriptions[f].descripcion).toBeTruthy();
      expect(r.interpretation.factorDescriptions[f].descripcion).not.toContain('[object');
    }
  });
});
