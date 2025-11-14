import { Injectable, Logger } from '@nestjs/common';
import { TestAnswer } from '../entities/test-answer.entity';

export interface TestILScoringResult {
  rawScores: {
    total: number; // Total de respuestas correctas (0-20)
  };
  scaledScores: {
    percentage: number; // Porcentaje de respuestas correctas
  };
  interpretation: {
    nivel: 'BAJO' | 'MEDIO' | 'ALTO';
    descripcion: string;
    capacidades: string[];
    recomendaciones: string[];
  };
}

/**
 * Servicio de scoring para el Test IL (Inteligencia Laboral / Wonderlic)
 *
 * El test IL evalúa la capacidad cognitiva general mediante:
 * - Razonamiento lógico: patrones, secuencias y relaciones
 * - Razonamiento numérico: cálculos básicos y problemas matemáticos
 * - Razonamiento verbal: comprensión de palabras y conceptos
 *
 * Metodología: Opción múltiple (A, B, C, D)
 * - 20 preguntas con UNA respuesta correcta
 * - 1 punto por respuesta correcta
 * - Puntaje máximo: 20
 * - Límite de tiempo: 12 minutos
 */
@Injectable()
export class TestILScoringService {
  private readonly logger = new Logger(TestILScoringService.name);

  /**
   * Calcula el puntaje del Test IL (Wonderlic)
   */
  calculateScore(answers: TestAnswer[]): TestILScoringResult {
    this.logger.log(`Calculando puntaje IL para ${answers.length} respuestas`);

    if (answers.length !== 20) {
      this.logger.warn(`Test IL incompleto: ${answers.length}/20 respuestas`);
    }

    // Contar respuestas correctas
    let correctCount = 0;

    for (const answer of answers) {
      const userAnswer = answer.answer;
      const correctAnswer = answer.fixedTestQuestion?.correctAnswer;

      if (!correctAnswer || typeof correctAnswer !== 'object') {
        this.logger.warn(
          `Pregunta ${answer.fixedTestQuestion?.questionNumber} sin respuesta correcta definida`
        );
        continue;
      }

      // El correctAnswer tiene formato: { "answer": "C" }
      const correctOption = (correctAnswer as any).answer;

      // Comparar respuesta del usuario con la correcta
      if (userAnswer === correctOption) {
        correctCount++;
      }
    }

    const rawScores = {
      total: correctCount,
    };

    const scaledScores = {
      percentage: answers.length > 0 ? Math.round((correctCount / 20) * 100) : 0,
    };

    this.logger.log(`Puntaje IL: ${correctCount}/20 (${scaledScores.percentage}%)`);

    // Generar interpretación
    const interpretation = this.interpretScore(correctCount);

    return {
      rawScores,
      scaledScores,
      interpretation,
    };
  }

  /**
   * Interpreta el puntaje según los rangos establecidos
   */
  private interpretScore(score: number): TestILScoringResult['interpretation'] {
    let nivel: 'BAJO' | 'MEDIO' | 'ALTO';
    let descripcion: string;
    let capacidades: string[];
    let recomendaciones: string[];

    if (score >= 15) {
      // Alto: 15-20
      nivel = 'ALTO';
      descripcion = 'Alta capacidad de razonamiento y rapidez mental';
      capacidades = [
        'Excelente capacidad para resolver problemas complejos',
        'Alta rapidez en el procesamiento de información',
        'Buen razonamiento lógico, numérico y verbal',
        'Capacidad para aprender rápidamente nuevas tareas',
        'Buen desempeño bajo presión de tiempo',
      ];
      recomendaciones = [
        'Apto para roles que requieren análisis complejo y toma de decisiones rápidas',
        'Puede manejar múltiples tareas simultáneamente',
        'Capacidad para resolver problemas no estructurados',
        'Adecuado para posiciones de liderazgo técnico o estratégico',
      ];
    } else if (score >= 8) {
      // Medio: 8-14
      nivel = 'MEDIO';
      descripcion = 'Capacidad promedio para el razonamiento y comprensión';
      capacidades = [
        'Capacidad adecuada para resolver problemas rutinarios',
        'Buen seguimiento de instrucciones claras',
        'Razonamiento suficiente para tareas estructuradas',
        'Puede aprender con capacitación apropiada',
      ];
      recomendaciones = [
        'Apto para roles operativos y técnicos con procedimientos definidos',
        'Beneficiaría de capacitación específica para tareas complejas',
        'Puede requerir más tiempo para procesos de aprendizaje',
        'Adecuado para posiciones con supervisión y guías claras',
      ];
    } else {
      // Bajo: 0-7
      nivel = 'BAJO';
      descripcion = 'Dificultad para resolver problemas o seguir instrucciones complejas';
      capacidades = [
        'Puede presentar dificultades con tareas que requieren razonamiento abstracto',
        'Necesita instrucciones muy claras y estructuradas',
        'Puede requerir más tiempo para procesar información',
        'Mejor desempeño en tareas simples y repetitivas',
      ];
      recomendaciones = [
        'Apto para roles operativos simples con procedimientos muy claros',
        'Requiere capacitación intensiva y supervisión cercana',
        'Puede beneficiarse de instrucciones paso a paso',
        'Considerar asignación a tareas con baja complejidad cognitiva',
        'Evaluar si requiere apoyo adicional para cumplir con los requisitos del puesto',
      ];
    }

    return {
      nivel,
      descripcion,
      capacidades,
      recomendaciones,
    };
  }

  /**
   * Genera un resumen ejecutivo del resultado
   */
  generateExecutiveSummary(result: TestILScoringResult): string {
    const { nivel, descripcion } = result.interpretation;
    const { total } = result.rawScores;
    const { percentage } = result.scaledScores;

    return (
      `TEST IL - INTELIGENCIA LABORAL (WONDERLIC)\n\n` +
      `Puntaje: ${total}/20 (${percentage}%)\n` +
      `Nivel: ${nivel}\n\n` +
      `${descripcion}\n\n` +
      `Capacidades Identificadas:\n${result.interpretation.capacidades.map(c => `• ${c}`).join('\n')}\n\n` +
      `El Test IL evalúa la capacidad cognitiva general mediante razonamiento lógico, ` +
      `numérico y verbal, midiendo la rapidez mental en contextos laborales.`
    );
  }
}
