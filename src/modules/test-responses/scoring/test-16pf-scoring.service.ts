import { Injectable, Logger } from '@nestjs/common';
import { TestAnswer } from '../entities/test-answer.entity';

export interface Test16PFScoringResult {
  rawScores: {
    [factor: string]: number;
  };
  scaledScores: {
    [factor: string]: number; // Decatipos (1-10)
  };
  interpretation: {
    factorDescriptions: {
      [factor: string]: {
        decatipo: number;
        nivel: 'BAJO' | 'MEDIO' | 'ALTO';
        descripcion: string;
      };
    };
    resumenGlobal: string;
    recomendaciones: string[];
  };
}

/**
 * Servicio de scoring para el Test 16PF (16 Personality Factors)
 *
 * El 16PF evalúa 16 dimensiones fundamentales de la personalidad:
 * - A: Afectividad (Calidez)
 * - B: Razonamiento (Inteligencia)
 * - C: Estabilidad Emocional
 * - E: Dominancia
 * - F: Impulsividad (Animación)
 * - G: Conformidad Grupal (Atención a normas)
 * - H: Atrevimiento (Audacia social)
 * - I: Sensibilidad
 * - L: Suspicacia (Vigilancia)
 * - M: Imaginación (Abstracción)
 * - N: Astucia (Privacidad)
 * - O: Culpabilidad (Aprensión)
 * - Q1: Rebeldía (Apertura al cambio)
 * - Q2: Autosuficiencia
 * - Q3: Autocontrol (Perfeccionismo)
 * - Q4: Tensión
 */
@Injectable()
export class Test16PFScoringService {
  private readonly logger = new Logger(Test16PFScoringService.name);

  // 16 factores del test
  private readonly FACTORS = [
    'A', 'B', 'C', 'E', 'F', 'G', 'H', 'I',
    'L', 'M', 'N', 'O', 'Q1', 'Q2', 'Q3', 'Q4'
  ];

  // Número esperado de preguntas por factor (187 preguntas / 16 factores ≈ 11-12 por factor)
  private readonly EXPECTED_QUESTIONS_PER_FACTOR = {
    'A': 13, 'B': 8, 'C': 12, 'E': 11, 'F': 12, 'G': 13, 'H': 13, 'I': 11,
    'L': 10, 'M': 12, 'N': 12, 'O': 13, 'Q1': 11, 'Q2': 12, 'Q3': 12, 'Q4': 12
  };

  /**
   * Tabla normativa para el cálculo de decatipos
   * Media y desviación estándar por factor (valores aproximados para población general adulta)
   * Cada pregunta puede dar 0, 1, o 2 puntos, por lo que el máximo es numPreguntas * 2
   *
   * La fórmula de decatipos es: DT = (Z × 2) + 5.5
   * Donde Z = (PD - Media) / DesviaciónEstándar
   */
  private readonly NORMATIVE_TABLE: { [factor: string]: { mean: number; sd: number } } = {
    'A': { mean: 13.0, sd: 4.5 },   // Afectividad: max 26 (13 preguntas × 2)
    'B': { mean: 8.0, sd: 3.0 },    // Razonamiento: max 16 (8 preguntas × 2)
    'C': { mean: 12.0, sd: 4.0 },   // Estabilidad: max 24 (12 preguntas × 2)
    'E': { mean: 11.0, sd: 3.8 },   // Dominancia: max 22 (11 preguntas × 2)
    'F': { mean: 12.0, sd: 4.0 },   // Impulsividad: max 24 (12 preguntas × 2)
    'G': { mean: 13.0, sd: 4.5 },   // Conformidad: max 26 (13 preguntas × 2)
    'H': { mean: 13.0, sd: 4.5 },   // Atrevimiento: max 26 (13 preguntas × 2)
    'I': { mean: 11.0, sd: 3.8 },   // Sensibilidad: max 22 (11 preguntas × 2)
    'L': { mean: 10.0, sd: 3.5 },   // Suspicacia: max 20 (10 preguntas × 2)
    'M': { mean: 12.0, sd: 4.0 },   // Imaginación: max 24 (12 preguntas × 2)
    'N': { mean: 12.0, sd: 4.0 },   // Astucia: max 24 (12 preguntas × 2)
    'O': { mean: 13.0, sd: 4.5 },   // Culpabilidad: max 26 (13 preguntas × 2)
    'Q1': { mean: 11.0, sd: 3.8 },  // Rebeldía: max 22 (11 preguntas × 2)
    'Q2': { mean: 12.0, sd: 4.0 },  // Autosuficiencia: max 24 (12 preguntas × 2)
    'Q3': { mean: 12.0, sd: 4.0 },  // Autocontrol: max 24 (12 preguntas × 2)
    'Q4': { mean: 12.0, sd: 4.0 },  // Tensión: max 24 (12 preguntas × 2)
  };

  /**
   * Calcula el puntaje del Test 16PF
   */
  calculateScore(answers: TestAnswer[]): Test16PFScoringResult {
    this.logger.log(`Calculando puntaje 16PF para ${answers.length} respuestas`);

    if (answers.length !== 187) {
      this.logger.warn(`Test 16PF incompleto: ${answers.length}/187 respuestas`);
    }

    // Calcular puntajes brutos por factor
    const rawScores: { [factor: string]: number } = {};
    const factorCounts: { [factor: string]: number } = {};

    // Inicializar
    this.FACTORS.forEach(factor => {
      rawScores[factor] = 0;
      factorCounts[factor] = 0;
    });

    // Sumar puntajes por factor
    for (const answer of answers) {
      const factor = answer.fixedTestQuestion?.factor;
      if (!factor) {
        this.logger.warn(`Pregunta sin factor: ${answer.fixedTestQuestion?.questionNumber}`);
        continue;
      }

      const score = this.extractAnswerScore(answer);
      rawScores[factor] += score;
      factorCounts[factor]++;
    }

    this.logger.log(`Puntajes brutos por factor: ${JSON.stringify(rawScores)}`);

    // Convertir a decatipos (escala 1-10)
    const scaledScores = this.convertToDecatipos(rawScores, factorCounts);

    // Generar interpretación
    const interpretation = this.interpretScores(scaledScores);

    return {
      rawScores,
      scaledScores,
      interpretation,
    };
  }

  /**
   * Extrae el puntaje de la respuesta según las opciones de la pregunta
   */
  private extractAnswerScore(answer: TestAnswer): number {
    const selectedOption = answer.answer;
    const options = answer.fixedTestQuestion?.options;
    const questionNum = answer.fixedTestQuestion?.questionNumber;

    if (!options || !options.scoring) {
      this.logger.warn(`[Q${questionNum}] Pregunta sin opciones de scoring`);
      return 0;
    }

    // La respuesta puede ser "A", "B", "C", el texto de la opción, un número, o un objeto
    let optionKey = selectedOption;

    // Si la respuesta es un objeto con propiedad 'value' o similar
    if (typeof selectedOption === 'object' && selectedOption !== null) {
      optionKey = selectedOption.value || selectedOption.answer || selectedOption.option || Object.values(selectedOption)[0];
    }

    // Convertir a string
    optionKey = String(optionKey).trim();

    // Si la respuesta es un número, mapear a letra
    if (/^\d+$/.test(optionKey)) {
      const numKey = parseInt(optionKey, 10);
      const keys = ['A', 'B', 'C'];
      optionKey = keys[numKey - 1] || keys[numKey] || 'A';
    }

    // Intentar primero con la clave directa (A, B, C)
    let score = options.scoring[optionKey.toUpperCase()];

    // Si no encuentra por clave, buscar por el texto de la opción
    if (score === undefined) {
      // Buscar la clave cuyo valor coincide con la respuesta
      for (const [key, value] of Object.entries(options)) {
        if (key !== 'scoring' && key !== 'format' && value === optionKey) {
          score = options.scoring[key];
          break;
        }
      }
    }

    // Si aún no encuentra, puede ser que la respuesta sea el texto normalizado
    if (score === undefined) {
      const optionKeyLower = optionKey.toLowerCase();
      for (const [key, value] of Object.entries(options)) {
        if (key !== 'scoring' && key !== 'format' && String(value).toLowerCase() === optionKeyLower) {
          score = options.scoring[key];
          break;
        }
      }
    }

    if (score === undefined) {
      this.logger.warn(`[Q${questionNum}] Score no encontrado para "${optionKey}". Opciones: ${JSON.stringify(options)}`);
      return 0;
    }

    return score;
  }

  /**
   * Convierte los puntajes brutos (PD) a decatipos (escala 1-10)
   *
   * Fórmula correcta de decatipos según psicometría:
   * 1. Z = (PD - Media) / DesviaciónEstándar
   * 2. DT = (Z × 2) + 5.5 (redondeado)
   *
   * El decatipo es una escala estandarizada donde:
   * - 1-3: Bajo
   * - 4-7: Medio
   * - 8-10: Alto
   */
  private convertToDecatipos(
    rawScores: { [factor: string]: number },
    factorCounts: { [factor: string]: number }
  ): { [factor: string]: number } {
    const decatipos: { [factor: string]: number } = {};

    for (const factor of this.FACTORS) {
      const rawScore = rawScores[factor];  // PD (Puntuación Directa)
      const questionCount = factorCounts[factor];

      // Si no hay respuestas para este factor, asignar decatipo medio
      if (questionCount === 0) {
        decatipos[factor] = 5;
        continue;
      }

      // Obtener tabla normativa del factor
      const norm = this.NORMATIVE_TABLE[factor];
      if (!norm) {
        this.logger.warn(`No hay tabla normativa para factor ${factor}, usando valor por defecto`);
        decatipos[factor] = 5;
        continue;
      }

      // Paso 1: Calcular Z score
      // Z = (PD - Media) / DesviaciónEstándar
      const z = (rawScore - norm.mean) / norm.sd;

      // Paso 2: Convertir Z a Decatipo
      // DT = (Z × 2) + 5.5
      let dt = Math.round((z * 2) + 5.5);

      // Paso 3: Mantener entre 1 y 10
      if (dt < 1) dt = 1;
      if (dt > 10) dt = 10;

      decatipos[factor] = dt;

      this.logger.debug(
        `Factor ${factor}: PD=${rawScore}, Media=${norm.mean}, SD=${norm.sd}, Z=${z.toFixed(2)}, DT=${dt}`
      );
    }

    return decatipos;
  }

  /**
   * Interpreta los decatipos de cada factor
   */
  private interpretScores(scaledScores: { [factor: string]: number }): Test16PFScoringResult['interpretation'] {
    const factorDescriptions: any = {};

    for (const factor of this.FACTORS) {
      const decatipo = scaledScores[factor];
      factorDescriptions[factor] = this.interpretFactor(factor, decatipo);
    }

    // Generar resumen global y recomendaciones
    const resumenGlobal = this.generateGlobalSummary(scaledScores);
    const recomendaciones = this.generateRecommendations(scaledScores);

    return {
      factorDescriptions,
      resumenGlobal,
      recomendaciones,
    };
  }

  /**
   * Interpreta un factor individual según su decatipo
   */
  private interpretFactor(factor: string, decatipo: number): any {
    const nivel = decatipo <= 3 ? 'BAJO' : decatipo >= 8 ? 'ALTO' : 'MEDIO';

    const interpretations: { [key: string]: any } = {
      'A': {
        BAJO: 'Reservado, distante, crítico, inflexible',
        MEDIO: 'Balance entre calidez y distancia',
        ALTO: 'Cálido, participativo, generoso, atento a los demás'
      },
      'B': {
        BAJO: 'Pensamiento concreto, menor capacidad de abstracción',
        MEDIO: 'Razonamiento promedio',
        ALTO: 'Pensamiento abstracto, aprende rápidamente, inteligente'
      },
      'C': {
        BAJO: 'Reactivo, emocionalmente inestable, cambiante',
        MEDIO: 'Estabilidad emocional moderada',
        ALTO: 'Estable emocionalmente, maduro, calmado'
      },
      'E': {
        BAJO: 'Deferente, cooperativo, evita conflictos, sumiso',
        MEDIO: 'Balance entre asertividad y cooperación',
        ALTO: 'Dominante, asertivo, competitivo, terco'
      },
      'F': {
        BAJO: 'Serio, cuidadoso, taciturno, prudente',
        MEDIO: 'Nivel moderado de animación',
        ALTO: 'Animado, espontáneo, entusiasta, activo'
      },
      'G': {
        BAJO: 'Inconforme, descuida normas, oportunista',
        MEDIO: 'Atención moderada a normas',
        ALTO: 'Atento a normas, cumplidor, moralista, formal'
      },
      'H': {
        BAJO: 'Tímido, temeroso, cohibido en situaciones sociales',
        MEDIO: 'Audacia social moderada',
        ALTO: 'Atrevido, aventurero, socialmente audaz'
      },
      'I': {
        BAJO: 'Objetivo, práctico, realista, masculino',
        MEDIO: 'Balance entre sensibilidad y objetividad',
        ALTO: 'Sensible, estético, sentimental, femenino'
      },
      'L': {
        BAJO: 'Confiado, sin sospechas, adaptable',
        MEDIO: 'Nivel moderado de vigilancia',
        ALTO: 'Vigilante, suspicaz, escéptico, desconfiado'
      },
      'M': {
        BAJO: 'Práctico, orientado a soluciones, realista',
        MEDIO: 'Balance entre abstracción y practicidad',
        ALTO: 'Abstracto, imaginativo, distraído, bohemio'
      },
      'N': {
        BAJO: 'Directo, genuino, ingenuo, franco',
        MEDIO: 'Nivel moderado de privacidad',
        ALTO: 'Privado, calculador, discreto, diplomático'
      },
      'O': {
        BAJO: 'Seguro de sí mismo, sereno, complacido',
        MEDIO: 'Nivel moderado de aprensión',
        ALTO: 'Aprensivo, inseguro, culpable, preocupado'
      },
      'Q1': {
        BAJO: 'Tradicional, apegado a lo familiar, conservador',
        MEDIO: 'Apertura moderada al cambio',
        ALTO: 'Abierto al cambio, experimenta, liberal, crítico'
      },
      'Q2': {
        BAJO: 'Gregario, dependiente del grupo, afiliativo',
        MEDIO: 'Balance entre autosuficiencia y dependencia',
        ALTO: 'Autosuficiente, solitario, individualista'
      },
      'Q3': {
        BAJO: 'Tolera el desorden, flexible, improvisado',
        MEDIO: 'Nivel moderado de control',
        ALTO: 'Perfeccionista, organizado, autocontrol, disciplinado'
      },
      'Q4': {
        BAJO: 'Relajado, plácido, tranquilo, paciente',
        MEDIO: 'Nivel moderado de tensión',
        ALTO: 'Tenso, enérgico, impaciente, frustrado'
      }
    };

    const descripcion = interpretations[factor]?.[nivel] || 'Sin interpretación disponible';

    return {
      decatipo,
      nivel,
      descripcion
    };
  }

  /**
   * Genera un resumen global de la personalidad
   */
  private generateGlobalSummary(scaledScores: { [factor: string]: number }): string {
    const highlights: string[] = [];

    // Identificar factores destacados (muy altos o muy bajos)
    for (const factor of this.FACTORS) {
      const score = scaledScores[factor];
      if (score <= 2) {
        highlights.push(`${factor} muy bajo`);
      } else if (score >= 9) {
        highlights.push(`${factor} muy alto`);
      }
    }

    if (highlights.length === 0) {
      return 'Perfil de personalidad equilibrado sin factores extremos destacados.';
    }

    return `Perfil de personalidad con características destacadas: ${highlights.join(', ')}.`;
  }

  /**
   * Genera recomendaciones basadas en el perfil
   */
  private generateRecommendations(scaledScores: { [factor: string]: number }): string[] {
    const recommendations: string[] = [];

    // Estabilidad emocional baja (C)
    if (scaledScores['C'] <= 3) {
      recommendations.push('Considerar entrenamiento en manejo del estrés y regulación emocional');
    }

    // Conformidad grupal baja (G)
    if (scaledScores['G'] <= 3) {
      recommendations.push('Reforzar importancia del cumplimiento de normas y protocolos de seguridad');
    }

    // Autocontrol bajo (Q3)
    if (scaledScores['Q3'] <= 3) {
      recommendations.push('Supervisión cercana y establecimiento de sistemas de organización claros');
    }

    // Tensión muy alta (Q4)
    if (scaledScores['Q4'] >= 8) {
      recommendations.push('Evaluación de factores de estrés laboral y posibles intervenciones');
    }

    // Razonamiento bajo (B)
    if (scaledScores['B'] <= 3) {
      recommendations.push('Capacitación adicional y verificación de comprensión de instrucciones');
    }

    if (recommendations.length === 0) {
      recommendations.push('Perfil adecuado para el rol. Mantener seguimiento periódico.');
    }

    return recommendations;
  }

  /**
   * Genera un resumen ejecutivo del resultado
   */
  generateExecutiveSummary(result: Test16PFScoringResult): string {
    const { resumenGlobal, recomendaciones } = result.interpretation;

    return (
      `TEST 16PF - CUESTIONARIO FACTORIAL DE PERSONALIDAD\n\n` +
      `${resumenGlobal}\n\n` +
      `Recomendaciones:\n${recomendaciones.map(r => `• ${r}`).join('\n')}\n\n` +
      `Este test evalúa 16 dimensiones fundamentales de personalidad relevantes ` +
      `para el desempeño laboral y la adaptación al ambiente minero.`
    );
  }
}
