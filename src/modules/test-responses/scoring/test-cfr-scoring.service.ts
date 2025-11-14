import { Injectable, Logger } from '@nestjs/common';
import { TestAnswer } from '../entities/test-answer.entity';

export interface CFRScoringResult {
  rawScores: {
    total: number;
  };
  scaledScores: {
    total: number;
  };
  interpretation: {
    nivel: 'BAJO' | 'MEDIO' | 'ALTO';
    riesgo: 'PRUDENTE' | 'MODERADO' | 'IMPULSIVO';
    descripcion: string;
    recomendacion: string;
    esAptoParaSeguridad: boolean;
    esAptoParaOperacionCritica: boolean;
    requiereCapacitacion: boolean;
    alertLevel: 'success' | 'warning' | 'danger';
  };
}

@Injectable()
export class TestCFRScoringService {
  private readonly logger = new Logger(TestCFRScoringService.name);

  /**
   * Calcula el puntaje del Test CFR (Conducta Frente al Riesgo)
   *
   * Sistema de puntuación:
   * - 60 preguntas con escala Likert 1-5
   * - Puntaje total: suma de todas las respuestas
   * - Rango: 60 a 300 puntos
   *
   * Interpretación:
   * - BAJO (0-120): Prudente, reflexivo → IDEAL para operaciones críticas
   * - MEDIO (121-200): Riesgos moderados → ACEPTABLE con capacitación
   * - ALTO (201-300): Impulsivo → NO RECOMENDADO para seguridad
   */
  calculateScore(answers: TestAnswer[]): CFRScoringResult {
    this.logger.log(`Calculando puntaje CFR para ${answers.length} respuestas`);

    // Validar que tenemos 60 respuestas
    if (answers.length !== 60) {
      this.logger.warn(
        `Test CFR incompleto: ${answers.length}/60 respuestas`,
      );
    }

    // Calcular puntaje total
    let totalScore = 0;

    for (const answer of answers) {
      const value = this.extractAnswerValue(answer.answer);

      // Verificar si la pregunta es invertida (según metadata de la pregunta)
      const isReversed = answer.fixedTestQuestion?.metadata?.isReversed || false;

      if (isReversed) {
        // Invertir el puntaje: 1→5, 2→4, 3→3, 4→2, 5→1
        totalScore += 6 - value;
      } else {
        totalScore += value;
      }
    }

    this.logger.log(`Puntaje CFR calculado: ${totalScore}/300`);

    // Determinar nivel e interpretación
    const interpretation = this.interpretScore(totalScore);

    return {
      rawScores: {
        total: totalScore,
      },
      scaledScores: {
        total: totalScore,
      },
      interpretation,
    };
  }

  /**
   * Extrae el valor numérico de la respuesta
   */
  private extractAnswerValue(answer: any): number {
    // Si la respuesta es un número directamente
    if (typeof answer === 'number') {
      return answer;
    }

    // Si es un objeto con value
    if (typeof answer === 'object' && answer.value !== undefined) {
      return answer.value;
    }

    // Si es un string, intentar parsear
    if (typeof answer === 'string') {
      const parsed = parseInt(answer, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }

    this.logger.warn(`Respuesta inválida en CFR: ${JSON.stringify(answer)}`);
    return 0;
  }

  /**
   * Interpreta el puntaje total según los baremos del test
   */
  private interpretScore(totalScore: number): CFRScoringResult['interpretation'] {
    if (totalScore <= 120) {
      return {
        nivel: 'BAJO',
        riesgo: 'PRUDENTE',
        descripcion:
          'Persona prudente, reflexiva y con alta conciencia de consecuencias. ' +
          'Toma decisiones cuidadosamente evaluando riesgos. ' +
          'Evita situaciones de riesgo innecesario y prefiere la seguridad y estabilidad.',
        recomendacion:
          'IDEAL para roles con altos estándares de seguridad: ' +
          'operación de equipos pesados, manejo de explosivos, trabajo en altura, ' +
          'roles de seguridad y supervisión.',
        esAptoParaSeguridad: true,
        esAptoParaOperacionCritica: true,
        requiereCapacitacion: false,
        alertLevel: 'success',
      };
    } else if (totalScore <= 200) {
      return {
        nivel: 'MEDIO',
        riesgo: 'MODERADO',
        descripcion:
          'Asume riesgos moderados con balance entre prudencia y acción. ' +
          'Puede tomar decisiones con cierto nivel de riesgo calculado. ' +
          'Requiere refuerzo en procedimientos de seguridad y protocolos.',
        recomendacion:
          'ACEPTABLE para roles operativos con supervisión adecuada y capacitación continua. ' +
          'Recomendado para: mantenimiento, logística, roles operativos con protocolos claros. ' +
          'Requiere entrenamiento específico en seguridad y monitoreo periódico.',
        esAptoParaSeguridad: false,
        esAptoParaOperacionCritica: false,
        requiereCapacitacion: true,
        alertLevel: 'warning',
      };
    } else {
      // totalScore > 200
      return {
        nivel: 'ALTO',
        riesgo: 'IMPULSIVO',
        descripcion:
          'Tendencia marcada a la impulsividad y búsqueda de sensaciones. ' +
          'Puede tomar decisiones sin evaluar completamente las consecuencias. ' +
          'Disfruta de situaciones de alta adrenalina y puede minimizar riesgos reales.',
        recomendacion:
          'NO RECOMENDADO para roles críticos de seguridad sin intervención previa. ' +
          'Requiere capacitación intensiva en gestión de riesgos, control de impulsos y protocolos de seguridad. ' +
          'Se sugiere evaluación adicional antes de asignar a operaciones críticas. ' +
          'Considerar roles administrativos o de apoyo sin exposición a riesgos operacionales.',
        esAptoParaSeguridad: false,
        esAptoParaOperacionCritica: false,
        requiereCapacitacion: true,
        alertLevel: 'danger',
      };
    }
  }

  /**
   * Genera un resumen ejecutivo del resultado
   */
  generateExecutiveSummary(result: CFRScoringResult): string {
    const { total } = result.rawScores;
    const { nivel, riesgo, recomendacion } = result.interpretation;

    return (
      `TEST CFR - CONDUCTA FRENTE AL RIESGO\n\n` +
      `Puntaje Total: ${total}/300\n` +
      `Nivel de Riesgo: ${nivel} (${riesgo})\n\n` +
      `${recomendacion}\n\n` +
      `Este test es CRÍTICO para la industria minera debido a los riesgos ` +
      `inherentes de la operación.`
    );
  }
}
