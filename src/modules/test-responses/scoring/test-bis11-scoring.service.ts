import { Injectable, Logger } from '@nestjs/common';
import { TestAnswer } from '../entities/test-answer.entity';
import {
  BIS11_DIMENSIONES,
  BIS11_INTERPRETACIONES,
  BIS11_ITEMS,
  BIS11_NOTA_METODOLOGICA,
  BIS11_NOTA_TABULACION,
  BIS11_OPCIONES,
  BIS11_REFERENCIA_TOTAL,
  BIS11_UMBRAL_DESEABILIDAD,
  BIS11_ALERTA_DESEABILIDAD,
  BIS11_VALOR_MAXIMO,
  BIS11_VALOR_MINIMO,
  DimensionBis11,
  NivelBis11,
} from '../../tests/shared/data/bis11.data';
import { resolverClaveDeOpcion } from './resolver-opcion';

export interface DimensionResultadoBis11 {
  clave: DimensionBis11 | 'TOTAL';
  nombre: string;
  items: number;
  puntaje: number;
  /** Puntaje mínimo posible: ítems × 1. */
  minimo: number;
  maximo: number;
  nivel: NivelBis11;
  interpretacion: string;
}

export interface RespuestaBis11 {
  item: number;
  dimension: DimensionBis11;
  respuesta: string;
  /** Respuesta de 1 (Raramente o nunca) a 4 (Siempre o casi siempre). */
  valor: number;
  inverso: boolean;
  /** Puntaje corregido: 5 - valor en los ítems inversos. */
  puntajeCorregido: number;
}

export interface TestBIS11ScoringResult {
  rawScores: Record<string, number>;
  scaledScores: Record<string, number>;
  interpretation: {
    /** Nivel del TOTAL, o NO_DETERMINADO si no se pudo leer. */
    nivel: NivelBis11 | 'NO_DETERMINADO';
    /** Interpretación del TOTAL (hoja «Resultados»). */
    descripcion: string;
    /** «Puntaje total: 58/120 puntos — Nivel: Moderado», como en la hoja «Informe». */
    resultadoResumen: string;
    dimensiones: DimensionResultadoBis11[];
    total: DimensionResultadoBis11 | null;
    /** Texto de alerta si el total sugiere respuestas por deseabilidad social. */
    alertaDeseabilidad: string | null;
    respuestas: RespuestaBis11[];
    notaTabulacion: string;
    notaMetodologica: string;
  };
}

const DIMENSIONES = Object.keys(BIS11_DIMENSIONES) as DimensionBis11[];

/** Claves de `rawScores`. */
export const CLAVE_PUNTAJE_BIS11: Record<DimensionBis11 | 'TOTAL', string> = {
  ATENCIONAL: 'atencional',
  MOTORA: 'motora',
  NO_PLANIFICACION: 'noPlanificacion',
  TOTAL: 'total',
};

/**
 * Nivel de una subescala, por tercios de su rango posible (mínimo a máximo).
 *
 * El Excel cortaba por tercios del máximo (Tabulación!E5), lo que con la
 * escala 0-1-3-4 equivalía al rango. Con 1-2-3-4 el mínimo ya no es cero:
 * cortar por tercios del máximo dejaría el «Bajo» casi inalcanzable (en la
 * atencional, de 8 a 10,7). Por eso se corta sobre el rango.
 */
export function nivelSubescalaBis11(
  puntaje: number,
  minimo: number,
  maximo: number,
): NivelBis11 {
  const tercio = (maximo - minimo) / 3;
  if (puntaje <= minimo + tercio) return 'Bajo';
  if (puntaje <= minimo + 2 * tercio) return 'Moderado';
  return 'Alto';
}

/**
 * Nivel del TOTAL contra la referencia poblacional del Excel.
 * Tabulación!E8: =IF(C8<63.88-11.32,"Bajo",IF(C8<=63.88+11.32,"Moderado","Alto"))
 */
export function nivelTotalBis11(puntaje: number): NivelBis11 {
  const { media, dt } = BIS11_REFERENCIA_TOTAL;
  if (puntaje < media - dt) return 'Bajo';
  if (puntaje <= media + dt) return 'Moderado';
  return 'Alto';
}

/**
 * Servicio de scoring de la Escala de Impulsividad de Barratt (BIS-11).
 *
 * Implementa las hojas Cuestionario, Tabulación y Resultados del Excel fuente:
 * - Respuesta: Raramente o nunca = 1, Ocasionalmente = 2, A menudo = 3,
 *   Siempre o casi siempre = 4 (la escala de la norma; ver bis11.data.ts).
 * - Puntaje corregido: 5 - respuesta en los ítems inversos.
 * - Puntaje por dimensión = suma de los corregidos; de ítems × 1 a ítems × 4.
 * - Nivel de las subescalas por tercios del rango; total contra media ± DT.
 * - Total menor a media - 2 DT: alerta de deseabilidad social.
 * - Interpretación: el texto de «Resultados» para cada dimensión y nivel.
 *
 * El test no aprueba ni reprueba: describe. A más puntaje, más impulsividad.
 */
@Injectable()
export class TestBIS11ScoringService {
  private readonly logger = new Logger(TestBIS11ScoringService.name);

  calculateScore(answers: TestAnswer[]): TestBIS11ScoringResult {
    const totalItems = BIS11_ITEMS.length;
    this.logger.log(
      `Calculando BIS-11 para ${answers.length} respuestas (${totalItems} ítems)`,
    );

    const opcionesPorDefecto = Object.fromEntries(
      BIS11_OPCIONES.map((o) => [o.clave, o.texto]),
    );
    const porItem = new Map<number, RespuestaBis11>();

    for (const answer of answers) {
      const numero = answer.fixedTestQuestion?.questionNumber;
      const item = BIS11_ITEMS.find((i) => i.numero === numero);
      if (!item) {
        this.logger.warn(
          `Respuesta a un ítem que el BIS-11 no tiene: ${numero}`,
        );
        continue;
      }

      const clave = resolverClaveDeOpcion(
        answer.answer,
        answer.fixedTestQuestion?.options ?? opcionesPorDefecto,
      );
      const opcion = BIS11_OPCIONES.find((o) => o.clave === clave);

      if (!opcion) {
        this.logger.warn(
          `Ítem ${numero}: no se pudo interpretar la respuesta ${JSON.stringify(answer.answer)}`,
        );
        continue;
      }

      porItem.set(item.numero, {
        item: item.numero,
        dimension: item.dimension,
        respuesta: opcion.texto,
        valor: opcion.valor,
        inverso: item.inverso,
        puntajeCorregido: item.inverso
          ? BIS11_VALOR_MINIMO + BIS11_VALOR_MAXIMO - opcion.valor
          : opcion.valor,
      });
    }

    /**
     * Con un ítem sin leer la suma queda corta y el nivel saldría más bajo de
     * lo que es: se leería como «menos impulsivo». No se informa.
     */
    if (porItem.size !== totalItems) {
      this.logger.error(
        `BIS-11: se interpretaron ${porItem.size} de ${totalItems} ítems. No se emite resultado.`,
      );
      return this.resultadoNoCalculable(porItem.size, totalItems);
    }

    const respuestas = [...porItem.values()].sort((a, b) => a.item - b.item);

    const dimensiones: DimensionResultadoBis11[] = DIMENSIONES.map(
      (dimension) => {
        const delaDimension = respuestas.filter(
          (r) => r.dimension === dimension,
        );
        const puntaje = delaDimension.reduce(
          (suma, r) => suma + r.puntajeCorregido,
          0,
        );
        const minimo = delaDimension.length * BIS11_VALOR_MINIMO;
        const maximo = delaDimension.length * BIS11_VALOR_MAXIMO;
        const nivel = nivelSubescalaBis11(puntaje, minimo, maximo);
        return {
          clave: dimension,
          nombre: BIS11_DIMENSIONES[dimension].nombre,
          items: delaDimension.length,
          puntaje,
          minimo,
          maximo,
          nivel,
          interpretacion: BIS11_INTERPRETACIONES[dimension][nivel],
        };
      },
    );

    const puntajeTotal = dimensiones.reduce((suma, d) => suma + d.puntaje, 0);
    const nivelTotal = nivelTotalBis11(puntajeTotal);
    const total: DimensionResultadoBis11 = {
      clave: 'TOTAL',
      nombre: 'TOTAL',
      items: respuestas.length,
      puntaje: puntajeTotal,
      minimo: dimensiones.reduce((suma, d) => suma + d.minimo, 0),
      maximo: dimensiones.reduce((suma, d) => suma + d.maximo, 0),
      nivel: nivelTotal,
      interpretacion: BIS11_INTERPRETACIONES.TOTAL[nivelTotal],
    };
    const alertaDeseabilidad =
      puntajeTotal < BIS11_UMBRAL_DESEABILIDAD
        ? BIS11_ALERTA_DESEABILIDAD
        : null;

    const rawScores: Record<string, number> = {};
    for (const d of [...dimensiones, total]) {
      rawScores[CLAVE_PUNTAJE_BIS11[d.clave]] = d.puntaje;
    }

    const resultadoResumen =
      `Puntaje total: ${total.puntaje}/${total.maximo} puntos — Nivel: ${total.nivel}` +
      (alertaDeseabilidad ? ' (posible deseabilidad social)' : '');
    this.logger.log(`BIS-11: ${resultadoResumen}`);

    return {
      rawScores,
      scaledScores: {},
      interpretation: {
        nivel: nivelTotal,
        descripcion: total.interpretacion,
        resultadoResumen,
        dimensiones,
        total,
        alertaDeseabilidad,
        respuestas,
        notaTabulacion: BIS11_NOTA_TABULACION,
        notaMetodologica: BIS11_NOTA_METODOLOGICA,
      },
    };
  }

  private resultadoNoCalculable(
    interpretados: number,
    total: number,
  ): TestBIS11ScoringResult {
    return {
      rawScores: {},
      scaledScores: {},
      interpretation: {
        nivel: 'NO_DETERMINADO',
        descripcion:
          `No fue posible calcular el resultado: se interpretaron ${interpretados} de ${total} ítems y la escala requiere los ${total}. ` +
          'Este resultado NO describe a la persona y no debe usarse para evaluarla. Pídele que rinda el test nuevamente o avísale al equipo de Talentree.',
        resultadoResumen: 'No determinado',
        dimensiones: [],
        total: null,
        alertaDeseabilidad: null,
        respuestas: [],
        notaTabulacion: BIS11_NOTA_TABULACION,
        notaMetodologica: BIS11_NOTA_METODOLOGICA,
      },
    };
  }
}
