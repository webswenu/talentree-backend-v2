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

    if (!options || !options.scoring) {
      this.logger.warn('Pregunta sin opciones de scoring');
      return 0;
    }

    // La respuesta puede ser "A", "B", "C" o un número
    let optionKey = selectedOption;

    // Si la respuesta es un número, necesitamos mapearla a la letra
    if (typeof selectedOption === 'number') {
      const keys = ['A', 'B', 'C'];
      optionKey = keys[selectedOption - 1] || 'A';
    }

    const score = options.scoring[optionKey];

    if (score === undefined) {
      this.logger.warn(`Score no encontrado para opción ${optionKey}`);
      return 0;
    }

    return score;
  }

  /**
   * Convierte los puntajes brutos a decatipos (escala 1-10)
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
      const rawScore = rawScores[factor];
      const questionCount = factorCounts[factor];
      const expectedCount = this.EXPECTED_QUESTIONS_PER_FACTOR[factor] || 12;

      // Calcular el máximo posible (cada pregunta puede dar 0, 1, o 2 puntos)
      const maxPossible = expectedCount * 2;

      // Normalizar a escala 0-1
      const normalized = questionCount > 0 ? rawScore / maxPossible : 0;

      // Convertir a decatipo (1-10)
      // Usamos una distribución lineal simple por ahora
      const decatipo = Math.max(1, Math.min(10, Math.round(normalized * 10) + 1));

      decatipos[factor] = decatipo;
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
