import { Injectable, Logger } from '@nestjs/common';
import { TestAnswer } from '../entities/test-answer.entity';

export interface TestICScoringResult {
  rawScores: {
    total: number; // Total de marcas correctas (0-20)
    column1: number; // Marcas correctas en columna 1
    column2: number; // Marcas correctas en columna 2
    column3: number; // Marcas correctas en columna 3
  };
  scaledScores: {
    percentage: number; // Porcentaje de marcas correctas
  };
  interpretation: {
    nivel: 'MUY_BAJO' | 'BAJO' | 'PROMEDIO' | 'ALTO' | 'MUY_ALTO';
    descripcion: string;
    capacidades: string[];
    recomendaciones: string[];
  };
}

/**
 * Servicio de scoring para el Test IC (Instrucciones Complejas)
 *
 * El test IC evalúa:
 * - Comprensión lectora de instrucciones complejas
 * - Capacidad de análisis de criterios múltiples
 * - Razonamiento lógico aplicado a datos tabulares
 * - Atención al detalle
 *
 * Metodología: Tabla con checkboxes
 * - Una tabla con 25 filas de datos de seguros
 * - 3 instrucciones con criterios específicos
 * - El candidato debe marcar las filas que cumplen cada criterio
 * - 1 punto por cada marca correcta (máximo 20 puntos)
 */
@Injectable()
export class TestICScoringService {
  private readonly logger = new Logger(TestICScoringService.name);

  /**
   * Calcula el puntaje del Test IC
   */
  calculateScore(answers: TestAnswer[]): TestICScoringResult {
    this.logger.log(`Calculando puntaje IC para ${answers.length} respuesta(s)`);

    if (answers.length !== 1) {
      this.logger.warn(`Test IC debe tener exactamente 1 respuesta, tiene: ${answers.length}`);
    }

    const answer = answers[0];
    const userAnswer = answer.answer;
    const correctAnswer = answer.fixedTestQuestion?.correctAnswer;

    if (!correctAnswer || typeof correctAnswer !== 'object') {
      this.logger.error('Respuesta correcta no definida para TEST_IC');
      return this.getEmptyResult();
    }

    // Calcular puntos por columna
    let column1Score = 0;
    let column2Score = 0;
    let column3Score = 0;

    // La respuesta correcta tiene formato: { column1: [1,3,6,...], column2: [...], column3: [...] }
    const correctColumn1 = (correctAnswer as any).column1 || [];
    const correctColumn2 = (correctAnswer as any).column2 || [];
    const correctColumn3 = (correctAnswer as any).column3 || [];

    // La respuesta del usuario tiene formato: { column1: [1,2,3,...], column2: [...], column3: [...] }
    const userColumn1 = userAnswer?.column1 || [];
    const userColumn2 = userAnswer?.column2 || [];
    const userColumn3 = userAnswer?.column3 || [];

    // Contar marcas correctas en cada columna
    column1Score = this.countCorrectMarks(userColumn1, correctColumn1);
    column2Score = this.countCorrectMarks(userColumn2, correctColumn2);
    column3Score = this.countCorrectMarks(userColumn3, correctColumn3);

    const totalScore = column1Score + column2Score + column3Score;

    const rawScores = {
      total: totalScore,
      column1: column1Score,
      column2: column2Score,
      column3: column3Score,
    };

    const scaledScores = {
      percentage: Math.round((totalScore / 20) * 100),
    };

    this.logger.log(`Puntaje IC: ${totalScore}/20 (${scaledScores.percentage}%)`);
    this.logger.log(`Detalle: Col1=${column1Score}/${correctColumn1.length}, Col2=${column2Score}/${correctColumn2.length}, Col3=${column3Score}/${correctColumn3.length}`);

    // Generar interpretación
    const interpretation = this.interpretScore(totalScore);

    return {
      rawScores,
      scaledScores,
      interpretation,
    };
  }

  /**
   * Cuenta cuántas marcas del usuario coinciden con las correctas
   * Solo cuenta marcas que están en ambas listas
   */
  private countCorrectMarks(userMarks: number[], correctMarks: number[]): number {
    if (!Array.isArray(userMarks) || !Array.isArray(correctMarks)) {
      return 0;
    }

    let count = 0;
    for (const mark of userMarks) {
      if (correctMarks.includes(mark)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Interpreta el puntaje según los rangos establecidos
   */
  private interpretScore(score: number): TestICScoringResult['interpretation'] {
    let nivel: 'MUY_BAJO' | 'BAJO' | 'PROMEDIO' | 'ALTO' | 'MUY_ALTO';
    let descripcion: string;
    let capacidades: string[];
    let recomendaciones: string[];

    if (score >= 17) {
      // Muy Alto: 17-20
      nivel = 'MUY_ALTO';
      descripcion = 'Excelente nivel de comprensión lógica y atención al detalle';
      capacidades = [
        'Excelente comprensión de instrucciones complejas',
        'Alta capacidad de análisis de criterios múltiples simultáneos',
        'Atención excepcional al detalle',
        'Razonamiento lógico superior aplicado a datos estructurados',
        'Procesamiento eficiente de información compleja',
      ];
      recomendaciones = [
        'Apto para roles que requieren análisis complejo de información',
        'Capacidad para manejar procedimientos detallados y multi-criterio',
        'Adecuado para posiciones de control de calidad y auditoría',
        'Puede supervisar procesos que requieren alta precisión',
      ];
    } else if (score >= 13) {
      // Alto: 13-16
      nivel = 'ALTO';
      descripcion = 'Buena comprensión y atención';
      capacidades = [
        'Buena comprensión de instrucciones complejas',
        'Capacidad sólida para aplicar múltiples criterios',
        'Atención al detalle adecuada',
        'Buen razonamiento lógico',
      ];
      recomendaciones = [
        'Apto para roles operativos con procedimientos detallados',
        'Puede manejar tareas que requieren seguir instrucciones específicas',
        'Adecuado para posiciones administrativas con normativas',
        'Capacidad para roles de cumplimiento y verificación',
      ];
    } else if (score >= 9) {
      // Promedio: 9-12
      nivel = 'PROMEDIO';
      descripcion = 'Comprensión adecuada, algunos errores por descuido';
      capacidades = [
        'Comprensión básica de instrucciones complejas',
        'Puede aplicar criterios con supervisión',
        'Atención al detalle variable',
        'Razonamiento lógico funcional',
      ];
      recomendaciones = [
        'Apto para roles con instrucciones claras y estructuradas',
        'Beneficiaría de capacitación en procedimientos',
        'Requiere supervisión en tareas complejas',
        'Puede mejorar con práctica y retroalimentación',
      ];
    } else if (score >= 5) {
      // Bajo: 5-8
      nivel = 'BAJO';
      descripcion = 'Dificultad moderada, errores frecuentes de interpretación';
      capacidades = [
        'Dificultad con instrucciones complejas',
        'Errores frecuentes al aplicar múltiples criterios',
        'Atención al detalle inconsistente',
        'Requiere instrucciones simplificadas',
      ];
      recomendaciones = [
        'Apto para roles operativos simples con instrucciones paso a paso',
        'Requiere capacitación intensiva y supervisión cercana',
        'Beneficiaría de procedimientos visuales y simplificados',
        'Considerar asignación a tareas con criterios únicos y claros',
      ];
    } else {
      // Muy Bajo: 0-4
      nivel = 'MUY_BAJO';
      descripcion = 'Dificultad notable para seguir instrucciones complejas';
      capacidades = [
        'Dificultad significativa con instrucciones complejas',
        'No puede aplicar múltiples criterios simultáneamente',
        'Baja atención al detalle',
        'Requiere instrucciones muy simples y directas',
      ];
      recomendaciones = [
        'Apto solo para roles operativos muy simples',
        'Requiere capacitación exhaustiva con acompañamiento',
        'Necesita supervisión constante',
        'Instrucciones deben ser extremadamente claras y únicas',
        'Evaluar si requiere apoyo adicional para cumplir requisitos del puesto',
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
   * Retorna un resultado vacío cuando no hay datos válidos
   */
  private getEmptyResult(): TestICScoringResult {
    return {
      rawScores: { total: 0, column1: 0, column2: 0, column3: 0 },
      scaledScores: { percentage: 0 },
      interpretation: {
        nivel: 'MUY_BAJO',
        descripcion: 'No se pudo evaluar',
        capacidades: [],
        recomendaciones: [],
      },
    };
  }

  /**
   * Genera un resumen ejecutivo del resultado
   */
  generateExecutiveSummary(result: TestICScoringResult): string {
    const { nivel, descripcion } = result.interpretation;
    const { total } = result.rawScores;
    const { percentage } = result.scaledScores;

    return (
      `TEST IC - INSTRUCCIONES COMPLEJAS\n\n` +
      `Puntaje: ${total}/20 (${percentage}%)\n` +
      `Nivel: ${nivel}\n\n` +
      `${descripcion}\n\n` +
      `Capacidades Identificadas:\n${result.interpretation.capacidades.map(c => `• ${c}`).join('\n')}\n\n` +
      `El Test IC evalúa la capacidad de comprensión lectora, análisis de criterios múltiples ` +
      `y razonamiento lógico aplicado a instrucciones complejas.`
    );
  }
}
