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
  /**
   * NOTA HISTORICA. Aqui habia una tabla normativa fija con la media y la
   * desviacion de cada factor. Se quito porque suponia una cantidad de
   * preguntas por factor que el cuestionario sembrado no tiene (13 para A y 8
   * para B; hay 11 y 13), asi que el decatipo salia corrido aunque el puntaje
   * bruto estuviera bien. El criterio con el que estaba construida —media = la
   * mitad del maximo, desviacion = un sexto— se conserva en normaAproximada(),
   * que lo aplica sobre los conteos reales.
   *
   * Sigue siendo una aproximacion declarada: no hay baremos, y sin baremos el
   * decatipo solo sirve para comparar candidatos entre si, no para situarlos
   * respecto de la poblacion.
   */



  /**
   * Los 13 items de razonamiento (factor B), con su respuesta correcta.
   *
   * POR QUE ESTA TABLA EXISTE. En el 16PF real el factor B no se puntua como
   * los otros quince: sus items son de capacidad, no de personalidad, y valen
   * 0 o 1 segun si la respuesta es CORRECTA, no 0/1/2 segun que opcion se
   * eligio. Aqui se estaban puntuando por posicion, asi que en varias de estas
   * preguntas acertar daba 0 y equivocarse daba 2.
   *
   * COMO SE IDENTIFICARON. No por criterio: el orden de las preguntas conserva
   * la estructura original del cuestionario, que cicla con periodo 19. Los 13
   * items de razonamiento caen en solo 2 de esas 19 ranuras; al azar se
   * esperarian ~9,6 ranuras distintas. Ese agrupamiento es del dato, no una
   * interpretacion.
   *
   * Tres respuestas quedaron marcadas como A CONFIRMAR porque admiten una
   * segunda lectura defendible. Se dejan puntuando con la lectura mas probable
   * y anotadas aqui, en vez de inventarlas en silencio.
   */
  private readonly ITEMS_DE_RAZONAMIENTO: { [numeroDePregunta: number]: string } = {
    3: 'B',    // Algo / Nada / Mucho -> "Nada"; las otras dos son cantidad presente
    22: 'B',   // A CONFIRMAR: Cansado:Trabajador :: Orgulloso:"Tener Exito" o "Ser Feliz"
    40: 'B',   // Vela / Luna / Luz Electrica -> "Luna"; las otras son luz artificial
    41: 'C',   // A CONFIRMAR: Miedo:"Terrible" (el estimulo) o "Ansioso" (la persona)
    59: 'B',   // 3/7, 3/9, 3/11 -> "3/9" es la unica reducible
    60: 'C',   // Tamano:Longitud :: Delito:"Robo" (tipo especifico de)
    78: 'A',   // AB:dc :: SR:"qp" (par anterior, invertido, en minuscula)
    79: 'A',   // Mejor:pesimo :: Menor:"Mayor" (opuesto)
    97: 'B',   // X1 O4 X2 O3 X3 ... -> siguen "OOXX"
    116: 'A',  // Pala:Cavar :: Cuchillo:"Cortar" (herramienta y su funcion)
    135: 'C',  // Llama:calor :: rosa:"Aroma" (lo que emite)
    154: 'A',  // Ancho / zigzag / Recto -> "Ancho"; las otras describen forma de trazo
    173: 'A',  // A CONFIRMAR: "nunca" es negacion y no opuesto -> "en ningun sitio"
  };

  /**
   * Norma asumida del factor B con puntuacion por acierto: 13 items de 0 o 1.
   *
   * Es un supuesto declarado, no un baremo medido: se toma la mitad del maximo
   * como media. Vale lo mismo que el resto de la tabla normativa de este
   * servicio, que tambien es aproximada por no disponer de los baremos.
   */
  private readonly NORMA_RAZONAMIENTO = { mean: 6.5, sd: 2.5 };

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
    let resueltas = 0;
    let razonamientoRespondidas = 0;

    for (const answer of answers) {
      const numero = answer.fixedTestQuestion?.questionNumber;
      const correcta = numero !== undefined ? this.ITEMS_DE_RAZONAMIENTO[numero] : undefined;

      // Los items de razonamiento van SIEMPRE al factor B y se puntuan por
      // acierto, sin importar a que factor los mande la siembra: hoy el
      // cuestionario los reparte entre once factores distintos, ninguno de
      // ellos B.
      if (correcta !== undefined) {
        const elegida = this.resolverLetraElegida(answer);
        if (elegida !== null) {
          razonamientoRespondidas++;
          resueltas++;
          if (elegida === correcta) rawScores['B'] += 1;
        }
        factorCounts['B']++;
        continue;
      }

      const factor = answer.fixedTestQuestion?.factor;
      if (!factor) {
        this.logger.warn(`Pregunta sin factor: ${numero}`);
        continue;
      }

      // B queda reservado a los items de razonamiento, que se puntuan por
      // acierto (0 o 1). Las preguntas de personalidad que caian en B se
      // dejan fuera: valen 0, 1 o 2, y mezclarlas romperia la escala.
      if (factor === 'B') {
        continue;
      }

      const score = this.extractAnswerScore(answer);
      if (score !== null) {
        rawScores[factor] += score;
        resueltas++;
      }
      factorCounts[factor]++;
    }

    this.logger.log(
      `Razonamiento (B): ${rawScores['B']}/${razonamientoRespondidas} aciertos ` +
        `sobre ${Object.keys(this.ITEMS_DE_RAZONAMIENTO).length} items`,
    );

    this.logger.log(
      `Puntajes brutos por factor: ${JSON.stringify(rawScores)} (${resueltas}/${answers.length} respuestas interpretadas)`,
    );

    // Si no se pudo interpretar ninguna respuesta, el resultado no existe: hay
    // que decirlo. Antes se seguia adelante con los 16 factores en cero, los
    // decatipos caian al piso (1) y el informe declaraba a la persona "muy
    // bajo" en las 16 dimensiones. Eso fue lo que quedo guardado en las dos
    // respuestas de 16PF que hay en produccion, ambas puntuadas antes de que
    // se agregara el respaldo por texto (11-12-2025).
    if (resueltas === 0) {
      this.logger.error(
        `16PF sin ninguna respuesta interpretable de ${answers.length}: no se emite dictamen`,
      );
      return this.resultadoNoCalculable(answers.length);
    }

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
  /**
   * Deja un texto comparable: sin tildes, sin espacios sobrantes, en minuscula.
   *
   * Hace falta en los dos lados. En produccion hay opciones sembradas como
   * "Si " (con espacio al final, 4 preguntas) y candidatos que respondieron
   * "Termino medio" con tilde contra una opcion sin tilde. Comparando en
   * crudo, esas respuestas no calzaban con ninguna opcion y valian cero.
   */
  private normalizar(valor: unknown): string {
    return String(valor ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toLowerCase();
  }

  /**
   * Devuelve la LETRA que eligio la persona (A, B o C), o null si no se puede
   * determinar.
   *
   * Hace falta aparte de extractAnswerScore porque en los items de
   * razonamiento no interesa el puntaje de la opcion sino cual se marco, para
   * compararla con la respuesta correcta. El front manda el TEXTO de la
   * opcion, asi que hay que traducirlo de vuelta a su letra.
   */
  private resolverLetraElegida(answer: TestAnswer): string | null {
    const options = answer.fixedTestQuestion?.options;
    if (!options) return null;

    let elegida: unknown = answer.answer;
    if (typeof elegida === 'object' && elegida !== null) {
      const obj = elegida as Record<string, unknown>;
      elegida = obj.value ?? obj.answer ?? obj.option ?? Object.values(obj)[0];
    }

    const crudo = String(elegida ?? '').trim();
    if (crudo === '') return null;

    // Ya viene como letra.
    if (/^[ABC]$/i.test(crudo)) return crudo.toUpperCase();

    // Viene como numero: 1 -> A, 2 -> B, 3 -> C.
    if (/^\d+$/.test(crudo)) {
      return ['A', 'B', 'C'][parseInt(crudo, 10) - 1] ?? null;
    }

    // Viene como el texto de la opcion.
    const buscado = this.normalizar(crudo);
    for (const [clave, valor] of Object.entries(options)) {
      if (clave === 'scoring' || clave === 'format') continue;
      if (this.normalizar(valor) === buscado) return clave.toUpperCase();
    }

    this.logger.warn(
      `[Q${answer.fixedTestQuestion?.questionNumber}] No se pudo resolver la letra de "${crudo}"`,
    );
    return null;
  }

  /**
   * Extrae el puntaje de la respuesta segun las opciones de la pregunta.
   *
   * Devuelve null cuando la respuesta no se puede interpretar, para poder
   * distinguirlo de un cero legitimo: en este test la opcion "A" vale 0, asi
   * que un cero es un dato valido y no puede usarse como senal de fallo.
   */
  private extractAnswerScore(answer: TestAnswer): number | null {
    const selectedOption = answer.answer;
    const options = answer.fixedTestQuestion?.options;
    const questionNum = answer.fixedTestQuestion?.questionNumber;

    if (!options || !options.scoring) {
      this.logger.warn(`[Q${questionNum}] Pregunta sin opciones de scoring`);
      return null;
    }

    // La respuesta puede venir como "A", como el texto de la opcion, como un
    // numero, o envuelta en un objeto.
    let optionKey: unknown = selectedOption;

    if (typeof selectedOption === 'object' && selectedOption !== null) {
      const obj = selectedOption as Record<string, unknown>;
      optionKey = obj.value ?? obj.answer ?? obj.option ?? Object.values(obj)[0];
    }

    let clave = String(optionKey ?? '').trim();
    if (clave === '') {
      return null;
    }

    // Un numero se mapea a la letra que le corresponde.
    if (/^\d+$/.test(clave)) {
      const numKey = parseInt(clave, 10);
      const keys = ['A', 'B', 'C'];
      clave = keys[numKey - 1] || keys[numKey] || 'A';
    }

    // 1) por clave directa (A, B, C)
    let score = options.scoring[clave.toUpperCase()];

    // 2) por el texto de la opcion, normalizado en ambos lados
    if (score === undefined) {
      const buscado = this.normalizar(clave);
      for (const [key, value] of Object.entries(options)) {
        if (key === 'scoring' || key === 'format') continue;
        if (this.normalizar(value) === buscado) {
          score = options.scoring[key];
          break;
        }
      }
    }

    if (score === undefined) {
      this.logger.warn(
        `[Q${questionNum}] Score no encontrado para "${clave}". Opciones: ${JSON.stringify(options)}`,
      );
      return null;
    }

    return score;
  }

  /**
   * Resultado para cuando no se pudo interpretar ninguna respuesta.
   *
   * Mismo criterio que en DISC e IL: es preferible decir que no se pudo
   * calcular a entregar un perfil inventado que alguien va a usar para
   * decidir sobre una persona.
   */
  private resultadoNoCalculable(totalRespuestas: number): Test16PFScoringResult {
    const rawScores: { [factor: string]: number } = {};
    const scaledScores: { [factor: string]: number } = {};
    const factorDescriptions: Test16PFScoringResult['interpretation']['factorDescriptions'] = {};

    this.FACTORS.forEach((factor) => {
      rawScores[factor] = 0;
      scaledScores[factor] = 0;
      factorDescriptions[factor] = {
        decatipo: 0,
        nivel: 'MEDIO',
        descripcion: 'No determinado: no se pudo interpretar la respuesta.',
      };
    });

    return {
      rawScores,
      scaledScores,
      interpretation: {
        factorDescriptions,
        resumenGlobal:
          `No fue posible calcular el perfil 16PF: ninguna de las ${totalRespuestas} ` +
          'respuestas registradas pudo asociarse a una opcion valida del test. ' +
          'Este resultado NO refleja la personalidad de la persona y no debe usarse ' +
          'para evaluarla. Es necesario revisar el registro de respuestas y volver a puntuar.',
        recomendaciones: [
          'No utilizar este resultado para tomar decisiones sobre el candidato.',
          'Revisar el registro de respuestas antes de volver a puntuar el test.',
        ],
      },
    };
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
  /**
   * Norma aproximada de un factor de personalidad, a partir de cuantas
   * preguntas tiene.
   *
   * Cada pregunta vale 0, 1 o 2, asi que el maximo del factor es 2n. Se toma
   * la media en la mitad de ese maximo y la desviacion en un sexto, que es el
   * criterio con el que estaba escrita la tabla fija original.
   */
  private normaAproximada(cantidadDePreguntas: number): { mean: number; sd: number } {
    const maximo = cantidadDePreguntas * 2;
    return { mean: maximo / 2, sd: Math.max(1, maximo / 6) };
  }

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

      // Norma del factor.
      //
      // La tabla fija de este servicio segui­a el criterio de su autor —media =
      // la mitad del maximo, desviacion = un sexto del maximo— pero con
      // conteos de preguntas que el cuestionario no tiene: supone 13 items
      // para A y 8 para B, y hay 11 y 13. Con la media equivocada el decatipo
      // sale corrido aunque el puntaje bruto este bien.
      //
      // Se mantiene EL MISMO criterio y se le dan los conteos reales, que ya
      // vienen contados en factorCounts. Sigue siendo una norma aproximada,
      // no un baremo medido, y como tal solo permite comparar candidatos entre
      // si; pero al menos ahora es coherente con el instrumento que se rindio.
      const norm = factor === 'B' ? this.NORMA_RAZONAMIENTO : this.normaAproximada(questionCount);
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
