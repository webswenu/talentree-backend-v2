import { Injectable, Logger } from '@nestjs/common';
import { TestAnswer } from '../entities/test-answer.entity';

export interface TestTACScoringResult {
  rawScores: {
    D1: number; // Orientación al Cliente
    D2: number; // Comunicación Efectiva
    D3: number; // Empatía
    D4: number; // Resolución de Problemas
    D5: number; // Tolerancia a la Frustración
    D6: number; // Trabajo Bajo Presión
    D7: number; // Actitud Positiva y Colaboración
  };
  scaledScores: {
    D1: number; // Promedio (1-5)
    D2: number;
    D3: number;
    D4: number;
    D5: number;
    D6: number;
    D7: number;
    global: number; // Promedio general
  };
  interpretation: {
    nivelGlobal: 'REQUIERE_MEJORA' | 'EN_DESARROLLO' | 'ADECUADO' | 'EXCELENTE';
    descripcionGlobal: string;
    dimensiones: {
      [dimension: string]: {
        nombre: string;
        promedio: number;
        nivel: string;
        descripcion: string;
      };
    };
    fortalezas: string[];
    areasDeDesarrollo: string[];
    recomendaciones: string[];
  };
}

/**
 * Servicio de scoring para el Test TAC (Test de Atención al Cliente)
 *
 * El test TAC evalúa 7 dimensiones de competencias para atención al cliente:
 * - D1: Orientación al Cliente
 * - D2: Comunicación Efectiva
 * - D3: Empatía
 * - D4: Resolución de Problemas
 * - D5: Tolerancia a la Frustración
 * - D6: Trabajo Bajo Presión
 * - D7: Actitud Positiva y Colaboración
 *
 * Metodología: Escala Likert (1-5)
 * - 30 preguntas con escala de 1 (Nunca) a 5 (Siempre)
 * - Promedio por dimensión
 * - Promedio global
 */
@Injectable()
export class TestTACScoringService {
  private readonly logger = new Logger(TestTACScoringService.name);

  // 7 dimensiones del TAC
  private readonly DIMENSIONS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'];

  // Nombres de las dimensiones
  private readonly DIMENSION_NAMES = {
    D1: 'Orientación al Cliente',
    D2: 'Comunicación Efectiva',
    D3: 'Empatía',
    D4: 'Resolución de Problemas',
    D5: 'Tolerancia a la Frustración',
    D6: 'Trabajo Bajo Presión',
    D7: 'Actitud Positiva y Colaboración',
  };

  /**
   * Calcula el puntaje del Test TAC
   */
  calculateScore(answers: TestAnswer[]): TestTACScoringResult {
    this.logger.log(`Calculando puntaje TAC para ${answers.length} respuestas`);

    if (answers.length !== 30) {
      this.logger.warn(`Test TAC incompleto: ${answers.length}/30 respuestas`);
    }

    // Inicializar contadores por dimensión
    const dimensionSums: { [key: string]: number } = {
      D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0, D7: 0,
    };
    const dimensionCounts: { [key: string]: number } = {
      D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0, D7: 0,
    };

    // Sumar respuestas por dimensión
    for (const answer of answers) {
      const factor = answer.fixedTestQuestion?.factor;
      const response = answer.answer;

      if (!factor || !this.DIMENSIONS.includes(factor)) {
        this.logger.warn(`Factor desconocido o faltante: ${factor}`);
        continue;
      }

      // La respuesta debe ser un número entre 1 y 5
      const value = typeof response === 'number' ? response : parseInt(response, 10);

      if (isNaN(value) || value < 1 || value > 5) {
        this.logger.warn(`Respuesta inválida para pregunta ${answer.fixedTestQuestion?.questionNumber}: ${response}`);
        continue;
      }

      dimensionSums[factor] += value;
      dimensionCounts[factor]++;
    }

    // Calcular promedios por dimensión
    const rawScores: any = {};
    const scaledScores: any = {};
    let globalSum = 0;
    let globalCount = 0;

    for (const dimension of this.DIMENSIONS) {
      const sum = dimensionSums[dimension];
      const count = dimensionCounts[dimension];
      const average = count > 0 ? sum / count : 0;

      rawScores[dimension] = sum;
      scaledScores[dimension] = parseFloat(average.toFixed(2));

      globalSum += sum;
      globalCount += count;
    }

    // Calcular promedio global
    const globalAverage = globalCount > 0 ? globalSum / globalCount : 0;
    scaledScores.global = parseFloat(globalAverage.toFixed(2));

    this.logger.log(`Puntaje TAC global: ${scaledScores.global.toFixed(2)}/5.0`);

    // Generar interpretación
    const interpretation = this.interpretScores(scaledScores);

    return {
      rawScores,
      scaledScores,
      interpretation,
    };
  }

  /**
   * Interpreta los puntajes TAC
   */
  private interpretScores(
    scaledScores: { [key: string]: number }
  ): TestTACScoringResult['interpretation'] {
    const globalScore = scaledScores.global;

    // Determinar nivel global
    let nivelGlobal: 'REQUIERE_MEJORA' | 'EN_DESARROLLO' | 'ADECUADO' | 'EXCELENTE';
    let descripcionGlobal: string;

    if (globalScore >= 4.0) {
      nivelGlobal = 'EXCELENTE';
      descripcionGlobal = 'Perfil excepcional para atención al cliente - Todas las competencias altamente desarrolladas';
    } else if (globalScore >= 3.0) {
      nivelGlobal = 'ADECUADO';
      descripcionGlobal = 'Perfil adecuado para atención al cliente - Competencias bien desarrolladas con áreas de oportunidad';
    } else if (globalScore >= 2.0) {
      nivelGlobal = 'EN_DESARROLLO';
      descripcionGlobal = 'Requiere desarrollo - Necesita capacitación en múltiples competencias';
    } else {
      nivelGlobal = 'REQUIERE_MEJORA';
      descripcionGlobal = 'Perfil no recomendado - Requiere mejora significativa en competencias clave';
    }

    // Interpretar cada dimensión
    const dimensiones: any = {};
    const fortalezas: string[] = [];
    const areasDeDesarrollo: string[] = [];

    for (const dimension of this.DIMENSIONS) {
      const score = scaledScores[dimension];
      const nivel = this.interpretDimensionLevel(score);
      const descripcion = this.getDimensionDescription(dimension, nivel);

      dimensiones[dimension] = {
        nombre: this.DIMENSION_NAMES[dimension],
        promedio: score,
        nivel,
        descripcion,
      };

      // Identificar fortalezas (>=4.0) y áreas de desarrollo (<3.0)
      if (score >= 4.0) {
        fortalezas.push(this.DIMENSION_NAMES[dimension]);
      } else if (score < 3.0) {
        areasDeDesarrollo.push(this.DIMENSION_NAMES[dimension]);
      }
    }

    // Generar recomendaciones
    const recomendaciones = this.generateRecommendations(nivelGlobal, areasDeDesarrollo);

    return {
      nivelGlobal,
      descripcionGlobal,
      dimensiones,
      fortalezas: fortalezas.length > 0 ? fortalezas : ['Perfil en desarrollo, aún no se identifican fortalezas claras'],
      areasDeDesarrollo: areasDeDesarrollo.length > 0 ? areasDeDesarrollo : ['Mantener y reforzar competencias actuales'],
      recomendaciones,
    };
  }

  /**
   * Interpreta el nivel de una dimensión específica
   */
  private interpretDimensionLevel(score: number): string {
    if (score >= 4.5) return 'Excelente';
    if (score >= 4.0) return 'Muy Bueno';
    if (score >= 3.5) return 'Bueno';
    if (score >= 3.0) return 'Adecuado';
    if (score >= 2.5) return 'En Desarrollo';
    if (score >= 2.0) return 'Requiere Atención';
    return 'Deficiente';
  }

  /**
   * Obtiene la descripción de una dimensión según su nivel
   */
  private getDimensionDescription(dimension: string, nivel: string): string {
    const descriptions: { [key: string]: { [level: string]: string } } = {
      D1: {
        'Excelente': 'Enfoque excepcional en satisfacer al cliente',
        'Muy Bueno': 'Fuerte orientación a las necesidades del cliente',
        'Bueno': 'Buen nivel de preocupación por el cliente',
        'Adecuado': 'Orientación básica al cliente',
        'En Desarrollo': 'Necesita fortalecer enfoque en el cliente',
        'Requiere Atención': 'Poca orientación al cliente',
        'Deficiente': 'No demuestra interés en el cliente',
      },
      D2: {
        'Excelente': 'Comunicación clara, empática y efectiva',
        'Muy Bueno': 'Muy buena capacidad de comunicación',
        'Bueno': 'Buena comunicación en general',
        'Adecuado': 'Comunicación funcional',
        'En Desarrollo': 'Necesita mejorar claridad y escucha',
        'Requiere Atención': 'Dificultades de comunicación frecuentes',
        'Deficiente': 'Comunicación deficiente',
      },
      D3: {
        'Excelente': 'Alta capacidad de conexión emocional',
        'Muy Bueno': 'Muy empático y comprensivo',
        'Bueno': 'Buena capacidad de empatía',
        'Adecuado': 'Empatía básica presente',
        'En Desarrollo': 'Necesita desarrollar empatía',
        'Requiere Atención': 'Baja capacidad de empatía',
        'Deficiente': 'No demuestra empatía',
      },
      D4: {
        'Excelente': 'Excelente en encontrar soluciones',
        'Muy Bueno': 'Muy buen solucionador de problemas',
        'Bueno': 'Buena capacidad de resolución',
        'Adecuado': 'Puede resolver problemas básicos',
        'En Desarrollo': 'Necesita mejorar análisis y solución',
        'Requiere Atención': 'Dificultad para resolver problemas',
        'Deficiente': 'No resuelve problemas efectivamente',
      },
      D5: {
        'Excelente': 'Excelente manejo de frustración',
        'Muy Bueno': 'Muy alta tolerancia a situaciones difíciles',
        'Bueno': 'Buena tolerancia a la frustración',
        'Adecuado': 'Tolera situaciones normales',
        'En Desarrollo': 'Se frustra con facilidad',
        'Requiere Atención': 'Baja tolerancia a la frustración',
        'Deficiente': 'No tolera la frustración',
      },
      D6: {
        'Excelente': 'Excelente desempeño bajo presión',
        'Muy Bueno': 'Muy buen manejo de la presión',
        'Bueno': 'Buen rendimiento bajo presión',
        'Adecuado': 'Puede manejar presión moderada',
        'En Desarrollo': 'Dificultad con alta demanda',
        'Requiere Atención': 'Bajo rendimiento bajo presión',
        'Deficiente': 'No puede trabajar bajo presión',
      },
      D7: {
        'Excelente': 'Actitud excepcionalmente positiva',
        'Muy Bueno': 'Muy positivo y colaborador',
        'Bueno': 'Buena actitud y colaboración',
        'Adecuado': 'Actitud generalmente positiva',
        'En Desarrollo': 'Necesita mejorar actitud',
        'Requiere Atención': 'Actitud frecuentemente negativa',
        'Deficiente': 'Actitud negativa predominante',
      },
    };

    return descriptions[dimension]?.[nivel] || 'Sin descripción';
  }

  /**
   * Genera recomendaciones según el nivel global y áreas de desarrollo
   */
  private generateRecommendations(
    nivel: string,
    areasDeDesarrollo: string[]
  ): string[] {
    const recommendations: string[] = [];

    switch (nivel) {
      case 'EXCELENTE':
        recommendations.push('Candidato ideal para roles de atención al cliente');
        recommendations.push('Puede servir como mentor para otros');
        recommendations.push('Apto para manejar clientes de alto valor');
        break;

      case 'ADECUADO':
        recommendations.push('Apto para roles de atención al cliente');
        recommendations.push('Beneficiaría de capacitación específica en áreas de desarrollo');
        if (areasDeDesarrollo.length > 0) {
          recommendations.push(`Reforzar: ${areasDeDesarrollo.join(', ')}`);
        }
        break;

      case 'EN_DESARROLLO':
        recommendations.push('Requiere capacitación antes de asumir rol de atención');
        recommendations.push('Considerar período de práctica supervisada');
        if (areasDeDesarrollo.length > 0) {
          recommendations.push(`Áreas prioritarias: ${areasDeDesarrollo.join(', ')}`);
        }
        break;

      case 'REQUIERE_MEJORA':
        recommendations.push('No recomendado para atención al cliente directa');
        recommendations.push('Requiere desarrollo significativo de competencias');
        recommendations.push('Considerar roles operativos sin contacto con clientes');
        break;
    }

    return recommendations;
  }

  /**
   * Genera un resumen ejecutivo del resultado
   */
  generateExecutiveSummary(result: TestTACScoringResult): string {
    const { nivelGlobal, descripcionGlobal } = result.interpretation;
    const { global } = result.scaledScores;

    return (
      `TEST TAC - ATENCIÓN AL CLIENTE\n\n` +
      `Puntaje Global: ${global.toFixed(2)}/5.0\n` +
      `Nivel: ${nivelGlobal}\n\n` +
      `${descripcionGlobal}\n\n` +
      `Fortalezas:\n${result.interpretation.fortalezas.map(f => `• ${f}`).join('\n')}\n\n` +
      `El Test TAC evalúa 7 dimensiones de competencias para atención al cliente ` +
      `mediante 30 afirmaciones con escala Likert.`
    );
  }
}
