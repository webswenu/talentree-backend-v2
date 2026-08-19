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
    /**
     * `NO_DETERMINADO` no es un nivel de la persona: es que no se pudo leer lo
     * que respondio. Se distingue a proposito de `BAJO`, porque son cosas
     * completamente distintas y antes se confundian.
     */
    nivel: 'BAJO' | 'MEDIO' | 'ALTO' | 'NO_DETERMINADO';
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
    let interpretadas = 0;

    for (const answer of answers) {
      const pregunta = answer.fixedTestQuestion;
      const correctAnswer = pregunta?.correctAnswer;

      if (!correctAnswer || typeof correctAnswer !== 'object') {
        this.logger.warn(
          `Pregunta ${pregunta?.questionNumber} sin respuesta correcta definida`
        );
        continue;
      }

      /**
       * EL DEFECTO QUE ARREGLA ESTO: antes se comparaba `userAnswer ===
       * correctOption` a secas. `correctAnswer` guarda la LETRA (`{answer:
       * "C"}`) y el formulario envia el TEXTO de la opcion ("50 minutos"),
       * porque normaliza las opciones con `.map(([, value]) => value)` y
       * descarta la clave. Nunca coincidian.
       *
       * Verificado en produccion el 19-08-2026: se respondieron las 20
       * correctas y el resultado fue 0/20, con dictamen «nivel BAJO -
       * Dificultad para resolver problemas o seguir instrucciones complejas».
       * Todo candidato recibia eso, respondiera lo que respondiera.
       *
       * Se resuelven ambos lados a la letra antes de comparar, que es lo que
       * ya hacia el puntuador de 16PF y por eso ese si funcionaba.
       */
      const elegida = this.resolverOpcion(answer.answer, pregunta?.options);
      const correcta = this.resolverOpcion(
        (correctAnswer as any).answer,
        pregunta?.options,
      );

      if (!elegida || !correcta) {
        this.logger.warn(
          `Pregunta ${pregunta?.questionNumber}: no se pudo interpretar la respuesta ` +
            `(elegida=${JSON.stringify(answer.answer)}, correcta=${JSON.stringify((correctAnswer as any).answer)})`,
        );
        continue;
      }

      interpretadas++;
      if (elegida === correcta) {
        correctCount++;
      }
    }

    /**
     * Sin una sola respuesta interpretable no hay puntaje que informar, y sobre
     * todo no hay que informar un CERO: un cero se lee como «contesto todo mal»
     * y aqui significa «no pudimos leer lo que contesto». Esa confusion es la
     * que hacia que a cualquiera se le dijera que tiene baja capacidad
     * cognitiva.
     */
    if (answers.length > 0 && interpretadas === 0) {
      this.logger.error(
        `Test IL sin ninguna respuesta interpretable (${answers.length} recibidas). No se emite nivel.`,
      );
      return this.resultadoNoCalculable();
    }

    if (interpretadas < answers.length) {
      this.logger.warn(
        `Test IL parcial: se interpretaron ${interpretadas} de ${answers.length} respuestas.`,
      );
    }

    const rawScores = {
      total: correctCount,
    };

    const scaledScores = {
      percentage: answers.length > 0 ? Math.round((correctCount / 20) * 100) : 0,
    };

    this.logger.log(
      `Puntaje IL: ${correctCount}/20 (${scaledScores.percentage}%) — ${interpretadas}/${answers.length} respuestas interpretadas`,
    );

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
  /**
   * Lleva una respuesta a la LETRA de la opcion (A, B, C, D).
   *
   * Acepta las tres formas que circulan, porque lo que importa es que la
   * comparacion sea entre iguales:
   *   "C"              -> la letra directa
   *   "50 minutos"     -> el texto de la opcion, que es lo que envia el
   *                       formulario al normalizar las opciones
   *   { value: "C" }   -> envuelta, por si algun cliente la manda asi
   *
   * Devuelve null cuando no se puede resolver, y quien llama decide: nunca se
   * asume «entonces esta mala», que era justamente el error.
   */
  private resolverOpcion(respuesta: unknown, opciones: unknown): string | null {
    if (respuesta === null || respuesta === undefined) return null;

    let valor: unknown = respuesta;
    if (typeof valor === 'object') {
      const envuelta = valor as Record<string, unknown>;
      valor = envuelta.value ?? envuelta.answer ?? envuelta.option ?? null;
    }

    if (typeof valor !== 'string' && typeof valor !== 'number') return null;

    const texto = String(valor).trim();
    if (!texto) return null;

    if (!opciones || typeof opciones !== 'object') return null;

    const mapa = opciones as Record<string, unknown>;
    const claves = Object.keys(mapa).filter(
      (k) => k !== 'scoring' && k !== 'format',
    );

    // Ya viene como letra.
    const porClave = claves.find((k) => k.toLowerCase() === texto.toLowerCase());
    if (porClave) return porClave;

    // Viene como el texto de la opcion.
    const porTexto = claves.find(
      (k) => String(mapa[k]).trim().toLowerCase() === texto.toLowerCase(),
    );
    if (porTexto) return porTexto;

    return null;
  }

  /**
   * Resultado para cuando no se pudo interpretar ninguna respuesta.
   *
   * El puntaje va en cero pero el nivel NO es «BAJO»: decir que alguien tiene
   * baja capacidad cognitiva porque el sistema no supo leer sus respuestas es
   * exactamente el daño que hay que evitar.
   */
  private resultadoNoCalculable(): TestILScoringResult {
    return {
      rawScores: { total: 0 },
      scaledScores: { percentage: 0 },
      interpretation: {
        nivel: 'NO_DETERMINADO',
        descripcion:
          'No fue posible calcular el resultado: las respuestas no quedaron en un formato interpretable. Este resultado NO refleja la capacidad de la persona y no debe usarse para evaluarla. Pídele que rinda el test nuevamente o avísale al equipo de Talentree.',
        capacidades: [],
        recomendaciones: [
          'No tomar decisiones de selección con este resultado.',
          'Repetir la evaluación.',
        ],
      },
    };
  }

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
