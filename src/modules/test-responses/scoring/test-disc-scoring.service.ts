import { Injectable, Logger } from '@nestjs/common';
import { TestAnswer } from '../entities/test-answer.entity';

export interface TestDISCScoringResult {
  rawScores: {
    D: number; // Dominancia
    I: number; // Influencia
    S: number; // Estabilidad
    C: number; // Cumplimiento
  };
  scaledScores: {
    D: number; // Porcentaje
    I: number;
    S: number;
    C: number;
  };
  interpretation: {
    perfilPredominante: string;
    perfilCombinado: string;
    descripcion: string;
    fortalezas: string[];
    areasDeDesarrollo: string[];
    recomendacionesLaborales: string[];
    estiloNatural: {
      D: string;
      I: string;
      S: string;
      C: string;
    };
  };
}

/**
 * Servicio de scoring para el Test DISC
 *
 * El test DISC evalúa 4 dimensiones del comportamiento:
 * - D (Dominancia): Cómo responde a problemas y desafíos
 * - I (Influencia): Cómo influye en otros y se relaciona
 * - S (Estabilidad): Cómo responde al ritmo y cambios
 * - C (Cumplimiento): Cómo responde a reglas y procedimientos
 *
 * Metodología: Elección forzada (MÁS/MENOS)
 * - +1 punto a la dimensión elegida como MÁS
 * - -1 punto a la dimensión elegida como MENOS
 */
@Injectable()
export class TestDISCScoringService {
  private readonly logger = new Logger(TestDISCScoringService.name);

  // 4 dimensiones del DISC
  private readonly DIMENSIONS = ['D', 'I', 'S', 'C'];

  /**
   * Calcula el puntaje del Test DISC
   */
  calculateScore(answers: TestAnswer[]): TestDISCScoringResult {
    this.logger.log(`Calculando puntaje DISC para ${answers.length} respuestas`);

    if (answers.length !== 24) {
      this.logger.warn(`Test DISC incompleto: ${answers.length}/24 respuestas`);
    }

    // Inicializar puntajes
    const rawScores = { D: 0, I: 0, S: 0, C: 0 };

    // Calcular puntajes algebraicos
    for (const answer of answers) {
      const response = answer.answer;

      // Validar que tengamos ambas selecciones (mas y menos)
      if (!response || typeof response !== 'object') {
        this.logger.warn(`Respuesta inválida en pregunta ${answer.fixedTestQuestion?.questionNumber}`);
        continue;
      }

      const mas = response.mas; // La palabra elegida como MÁS
      const menos = response.menos; // La palabra elegida como MENOS

      if (!mas || !menos) {
        this.logger.warn(
          `Respuesta incompleta en pregunta ${answer.fixedTestQuestion?.questionNumber}: mas=${mas}, menos=${menos}`
        );
        continue;
      }

      // Identificar las dimensiones a las que pertenecen las palabras elegidas
      const wordsDimensions = this.getWordDimensions(answer.fixedTestQuestion?.options);

      const masDimension = wordsDimensions[mas];
      const menosDimension = wordsDimensions[menos];

      if (masDimension) {
        rawScores[masDimension] += 1;
      }

      if (menosDimension) {
        rawScores[menosDimension] -= 1;
      }
    }

    this.logger.log(`Puntajes DISC (algebraicos): ${JSON.stringify(rawScores)}`);

    // Normalizar a escala positiva (el mínimo posible es -24, máximo +24)
    // Convertir a rango 0-48 y luego a porcentajes
    const normalizedScores = {
      D: rawScores.D + 24, // Rango: 0-48
      I: rawScores.I + 24,
      S: rawScores.S + 24,
      C: rawScores.C + 24,
    };

    const total = normalizedScores.D + normalizedScores.I + normalizedScores.S + normalizedScores.C;

    const scaledScores = {
      D: total > 0 ? Math.round((normalizedScores.D / total) * 100) : 25,
      I: total > 0 ? Math.round((normalizedScores.I / total) * 100) : 25,
      S: total > 0 ? Math.round((normalizedScores.S / total) * 100) : 25,
      C: total > 0 ? Math.round((normalizedScores.C / total) * 100) : 25,
    };

    // Generar interpretación
    const interpretation = this.interpretScores(rawScores, scaledScores);

    return {
      rawScores,
      scaledScores,
      interpretation,
    };
  }

  /**
   * Extrae las dimensiones de cada palabra en las opciones de la pregunta
   */
  private getWordDimensions(options: any): { [word: string]: 'D' | 'I' | 'S' | 'C' } {
    if (!options || !options.words) {
      return {};
    }

    const wordsDimensions: any = {};

    // Invertir el mapeo: de dimension->palabra a palabra->dimension
    for (const [dimension, word] of Object.entries(options.words)) {
      wordsDimensions[word as string] = dimension as 'D' | 'I' | 'S' | 'C';
    }

    return wordsDimensions;
  }

  /**
   * Interpreta los puntajes DISC
   */
  private interpretScores(
    rawScores: { D: number; I: number; S: number; C: number },
    scaledScores: { D: number; I: number; S: number; C: number }
  ): TestDISCScoringResult['interpretation'] {
    // Determinar perfil predominante (el más alto)
    const dimensionScores = [
      { dimension: 'D', score: scaledScores.D },
      { dimension: 'I', score: scaledScores.I },
      { dimension: 'S', score: scaledScores.S },
      { dimension: 'C', score: scaledScores.C },
    ];

    dimensionScores.sort((a, b) => b.score - a.score);

    const perfilPredominante = dimensionScores[0].dimension;

    // Perfil combinado (las dos dimensiones más altas)
    const perfilCombinado = `${dimensionScores[0].dimension}${dimensionScores[1].dimension}`;

    // Descripción del perfil
    const descripcion = this.getProfileDescription(perfilPredominante, perfilCombinado, scaledScores);

    // Fortalezas y áreas de desarrollo
    const fortalezas = this.getStrengths(perfilPredominante, scaledScores);
    const areasDeDesarrollo = this.getDevelopmentAreas(perfilPredominante, scaledScores);
    const recomendacionesLaborales = this.getWorkRecommendations(perfilCombinado);

    // Estilo natural por dimensión
    const estiloNatural = {
      D: this.interpretDimension('D', scaledScores.D),
      I: this.interpretDimension('I', scaledScores.I),
      S: this.interpretDimension('S', scaledScores.S),
      C: this.interpretDimension('C', scaledScores.C),
    };

    return {
      perfilPredominante,
      perfilCombinado,
      descripcion,
      fortalezas,
      areasDeDesarrollo,
      recomendacionesLaborales,
      estiloNatural,
    };
  }

  /**
   * Genera descripción del perfil
   */
  private getProfileDescription(predominante: string, combinado: string, scores: any): string {
    const descriptions: { [key: string]: string } = {
      'D': 'Perfil DOMINANTE: Orientado a resultados, decisivo, directo. Busca control y acepta desafíos.',
      'I': 'Perfil INFLUYENTE: Sociable, entusiasta, persuasivo. Le gusta trabajar con personas y comunicar ideas.',
      'S': 'Perfil ESTABLE: Paciente, leal, colaborador. Valora la estabilidad y el trabajo en equipo.',
      'C': 'Perfil CUMPLIDOR: Analítico, preciso, sistemático. Valora la calidad y el cumplimiento de normas.',
    };

    const combinedDescriptions: { [key: string]: string } = {
      'DI': 'Combinación Dominante-Influyente: Líder inspirador, competitivo y persuasivo.',
      'DC': 'Combinación Dominante-Cumplidor: Líder analítico, exigente con resultados de calidad.',
      'DS': 'Combinación Dominante-Estable: Líder equilibrado entre acción y colaboración.',
      'ID': 'Combinación Influyente-Dominante: Comunicador persuasivo con orientación a resultados.',
      'IS': 'Combinación Influyente-Estable: Facilitador social, empático y colaborativo.',
      'IC': 'Combinación Influyente-Cumplidor: Comunicador detallista que explica con precisión.',
      'SD': 'Combinación Estable-Dominante: Colaborador decidido que equilibra acción y equipo.',
      'SI': 'Combinación Estable-Influyente: Cooperador sociable, mediador natural.',
      'SC': 'Combinación Estable-Cumplidor: Colaborador meticuloso, confiable y consistente.',
      'CD': 'Combinación Cumplidor-Dominante: Perfeccionista orientado a resultados de calidad.',
      'CI': 'Combinación Cumplidor-Influyente: Analista persuasivo que comunica datos eficazmente.',
      'CS': 'Combinación Cumplidor-Estable: Especialista confiable que sigue procedimientos con paciencia.',
    };

    return descriptions[predominante] + ' ' + (combinedDescriptions[combinado] || '');
  }

  /**
   * Identifica fortalezas según el perfil
   */
  private getStrengths(predominante: string, scores: any): string[] {
    const allStrengths: { [key: string]: string[] } = {
      'D': ['Toma de decisiones rápidas', 'Orientación a resultados', 'Aceptación de desafíos', 'Liderazgo directo'],
      'I': ['Comunicación efectiva', 'Persuasión', 'Optimismo', 'Construcción de relaciones'],
      'S': ['Paciencia', 'Lealtad', 'Colaboración', 'Estabilidad bajo presión'],
      'C': ['Atención al detalle', 'Pensamiento analítico', 'Precisión', 'Cumplimiento de normas'],
    };

    const fortalezas: string[] = [];

    // Agregar fortalezas de dimensiones altas (>30%)
    for (const [dim, score] of Object.entries(scores)) {
      if (typeof score === 'number' && score > 30 && allStrengths[dim]) {
        fortalezas.push(...allStrengths[dim].slice(0, 2));
      }
    }

    return fortalezas.length > 0 ? fortalezas : ['Perfil equilibrado en múltiples dimensiones'];
  }

  /**
   * Identifica áreas de desarrollo
   */
  private getDevelopmentAreas(predominante: string, scores: any): string[] {
    const developmentAreas: { [key: string]: string[] } = {
      'D': ['Paciencia con procesos lentos', 'Escucha activa', 'Trabajo en equipo colaborativo'],
      'I': ['Atención a detalles', 'Seguimiento de tareas', 'Análisis crítico antes de decidir'],
      'S': ['Adaptación a cambios rápidos', 'Toma de decisiones bajo presión', 'Asertividad'],
      'C': ['Flexibilidad ante cambios', 'Delegación de tareas', 'Comunicación social'],
    };

    return developmentAreas[predominante] || ['Mantener equilibrio entre dimensiones'];
  }

  /**
   * Genera recomendaciones laborales
   */
  private getWorkRecommendations(combinado: string): string[] {
    const recommendations: { [key: string]: string[] } = {
      'DI': ['Roles de liderazgo y ventas', 'Gestión de equipos', 'Presentaciones ejecutivas'],
      'DC': ['Dirección de proyectos técnicos', 'Roles de auditoría y control de calidad', 'Gestión de operaciones'],
      'DS': ['Supervisión de equipos', 'Roles de coordinación', 'Gestión de recursos humanos'],
      'ID': ['Ventas y desarrollo de negocios', 'Marketing y comunicaciones', 'Capacitación'],
      'IS': ['Atención al cliente', 'Trabajo social', 'Coordinación de equipos'],
      'IC': ['Roles de comunicación técnica', 'Capacitación especializada', 'Consultoría'],
      'SD': ['Roles operativos con liderazgo', 'Coordinación de producción', 'Supervisión'],
      'SI': ['Servicio al cliente', 'Relaciones públicas', 'Facilitación de grupos'],
      'SC': ['Roles administrativos', 'Soporte técnico', 'Cumplimiento y control'],
      'CD': ['Ingeniería de proyectos', 'Control de calidad exigente', 'Auditoría'],
      'CI': ['Análisis de datos con presentaciones', 'Investigación aplicada', 'Consultoría técnica'],
      'CS': ['Roles de compliance', 'Administración detallada', 'Soporte operativo'],
    };

    return recommendations[combinado] || ['Roles versátiles que aprovechen múltiples dimensiones'];
  }

  /**
   * Interpreta una dimensión individual
   */
  private interpretDimension(dimension: string, score: number): string {
    const interpretations: { [key: string]: { [level: string]: string } } = {
      'D': {
        low: 'Prefiere cooperar y evitar confrontaciones',
        medium: 'Balance entre asertividad y cooperación',
        high: 'Directivo, acepta desafíos, busca control'
      },
      'I': {
        low: 'Prefiere trabajar de forma independiente',
        medium: 'Balance entre interacción social y trabajo individual',
        high: 'Sociable, entusiasta, influyente con otros'
      },
      'S': {
        low: 'Prefiere variedad y cambio frecuente',
        medium: 'Balance entre estabilidad y adaptabilidad',
        high: 'Paciente, estable, prefiere rutinas predecibles'
      },
      'C': {
        low: 'Flexible, se adapta fácilmente a cambios',
        medium: 'Balance entre estructura y flexibilidad',
        high: 'Analítico, preciso, sigue procedimientos'
      }
    };

    const level = score < 20 ? 'low' : score > 35 ? 'high' : 'medium';
    return interpretations[dimension][level];
  }

  /**
   * Genera un resumen ejecutivo del resultado
   */
  generateExecutiveSummary(result: TestDISCScoringResult): string {
    const { perfilPredominante, perfilCombinado, descripcion } = result.interpretation;

    return (
      `TEST DISC - PERFIL CONDUCTUAL\n\n` +
      `Perfil: ${perfilPredominante} (Combinado: ${perfilCombinado})\n\n` +
      `${descripcion}\n\n` +
      `Fortalezas Clave:\n${result.interpretation.fortalezas.map(f => `• ${f}`).join('\n')}\n\n` +
      `El test DISC evalúa el estilo conductual natural y cómo la persona ` +
      `responde a desafíos, interactúa con otros, maneja cambios y sigue procedimientos.`
    );
  }
}
