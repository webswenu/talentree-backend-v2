import { Injectable, Logger } from '@nestjs/common';
import { TestAnswer } from '../entities/test-answer.entity';
import {
  CEAL_ESTILOS,
  CEAL_NIVELES_EFECTIVIDAD,
  CEAL_PAUTA,
  CEAL_SITUACIONES,
  LetraCeal,
  NumeroEstiloCeal,
} from '../../tests/shared/data/ceal.data';
import { resolverClaveDeOpcion } from './resolver-opcion';

export interface EstiloResultadoCeal {
  numero: NumeroEstiloCeal;
  nombre: string;
  /** «Estilos situacionales»: cuántas de las 12 respuestas cayeron en el estilo. */
  predominio: number;
  /** «Efectividad situacional»: suma de la efectividad de esas respuestas. */
  efectividadSituacional: number;
  /**
   * Eficacia del estilo según la fórmula de la pauta:
   * efectividad situacional / estilos situacionales × 12.
   * Null cuando el estilo no se eligió nunca (la fórmula dividiría por cero).
   */
  efectividad: number | null;
  nivelEfectividad: string | null;
  /**
   * Cómo es percibido el estilo según el cuadro del feedback: EFICAZ si su
   * efectividad es positiva («responde a la situación»), INEFICAZ si es
   * negativa. En cero, o sin respuestas, no se caracteriza.
   */
  percepcion: {
    tipo: 'EFICAZ' | 'INEFICAZ';
    nombre: string;
    descripcion: string;
  } | null;
}

export interface RespuestaCeal {
  situacion: number;
  alternativa: LetraCeal;
  estilo: NumeroEstiloCeal;
  efectividad: number;
}

export interface TestCEALScoringResult {
  rawScores: Record<string, number>;
  scaledScores: Record<string, number>;
  interpretation: {
    /** Nivel de la efectividad general, o NO_DETERMINADO si no se pudo leer. */
    nivel: string;
    descripcion: string;
    /** Frase corta para la tabla resumen y las conclusiones del informe. */
    resultadoResumen: string;
    efectividadGeneral: { puntaje: number; nivel: string } | null;
    estilos: EstiloResultadoCeal[];
    estilosPredominantes: string[];
    respuestas: RespuestaCeal[];
    referenciaTeorica: string;
    formula: string;
    mide: string;
    aplicacion: string;
  };
}

const ESTILOS: NumeroEstiloCeal[] = [1, 2, 3, 4];

/** Claves de `rawScores` / `scaledScores` por estilo. */
export const CLAVE_PUNTAJE_ESTILO_CEAL: Record<NumeroEstiloCeal, string> = {
  1: 'autocratico',
  2: 'integrado',
  3: 'relacionado',
  4: 'separado',
};

/**
 * Nivel de la tabla de efectividades de la pauta (MUY BAJA … MUY ALTA).
 *
 * La tabla usa rangos enteros, pero la eficacia de un estilo puede ser decimal
 * (por ejemplo, -2 en 5 respuestas da -4,8). Se clasifica redondeando al entero
 * más cercano, alejándose del cero en los medios.
 */
export function nivelDeEfectividadCeal(valor: number): string {
  const entero = Math.sign(valor) * Math.round(Math.abs(valor));
  const nivel = CEAL_NIVELES_EFECTIVIDAD.find(
    (n) => entero >= n.min && entero <= n.max,
  );
  return nivel?.nombre ?? '';
}

/** +10, -3, 0, +7,20 */
export function formatearEfectividadCeal(valor: number): string {
  const texto = Number.isInteger(valor)
    ? String(valor)
    : valor.toFixed(2).replace('.', ',');
  return valor > 0 ? `+${texto}` : texto;
}

/**
 * Servicio de scoring del CEAL (Cuestionario de la Efectividad y Adaptabilidad
 * del Líder).
 *
 * Implementa la pauta de corrección del documento fuente:
 * - Cada una de las 12 situaciones se responde con A, B, C o D.
 * - En la hoja de respuesta, cada letra de cada situación tiene un estilo
 *   (1 Autocrático, 2 Integrado, 3 Relacionado, 4 Separado) y una efectividad
 *   (+2, +1, -1, -2).
 * - Predominio = cuántas respuestas hay en cada estilo.
 * - Efectividad de cada estilo = efectividad situacional / estilos
 *   situacionales × 12.
 * - Efectividad general = suma de las 12 efectividades (-24 a +24).
 *
 * El test no aprueba ni reprueba: describe estilos y efectividad.
 */
@Injectable()
export class TestCEALScoringService {
  private readonly logger = new Logger(TestCEALScoringService.name);

  calculateScore(answers: TestAnswer[]): TestCEALScoringResult {
    const totalSituaciones = CEAL_SITUACIONES.length;
    this.logger.log(
      `Calculando CEAL para ${answers.length} respuestas (${totalSituaciones} situaciones)`,
    );

    const porSituacion = new Map<number, RespuestaCeal>();

    for (const answer of answers) {
      const numero = answer.fixedTestQuestion?.questionNumber;
      const situacion = CEAL_SITUACIONES.find((s) => s.numero === numero);
      if (!situacion) {
        this.logger.warn(
          `Respuesta a una situación que el CEAL no tiene: ${numero}`,
        );
        continue;
      }

      const letra = resolverClaveDeOpcion(
        answer.answer,
        answer.fixedTestQuestion?.options ?? situacion.alternativas,
      ) as LetraCeal | null;
      const clave = letra ? situacion.clave[letra] : undefined;

      if (!clave) {
        this.logger.warn(
          `Situación ${numero}: no se pudo interpretar la respuesta ${JSON.stringify(answer.answer)}`,
        );
        continue;
      }

      porSituacion.set(situacion.numero, {
        situacion: situacion.numero,
        alternativa: letra,
        estilo: clave.estilo,
        efectividad: clave.efectividad,
      });
    }

    /**
     * El instrumento pide «No deje ninguna pregunta sin responder», y tanto el
     * predominio (3 por estilo en teoría) como la efectividad general (-24 a
     * +24) están construidos sobre las 12. Con menos no hay perfil que
     * informar, y sobre todo no se informa uno inventado.
     */
    if (porSituacion.size !== totalSituaciones) {
      this.logger.error(
        `CEAL: se interpretaron ${porSituacion.size} de ${totalSituaciones} situaciones. No se emite resultado.`,
      );
      return this.resultadoNoCalculable(porSituacion.size, totalSituaciones);
    }

    const respuestas = [...porSituacion.values()].sort(
      (a, b) => a.situacion - b.situacion,
    );

    const estilos: EstiloResultadoCeal[] = ESTILOS.map((numero) => {
      const delEstilo = respuestas.filter((r) => r.estilo === numero);
      const predominio = delEstilo.length;
      const efectividadSituacional = delEstilo.reduce(
        (suma, r) => suma + r.efectividad,
        0,
      );
      const efectividad =
        predominio > 0
          ? Math.round((efectividadSituacional / predominio) * 12 * 100) / 100
          : null;

      const estilo = CEAL_ESTILOS[numero];
      let percepcion: EstiloResultadoCeal['percepcion'] = null;
      if (efectividad !== null && efectividad > 0) {
        percepcion = { tipo: 'EFICAZ', ...estilo.eficaz };
      } else if (efectividad !== null && efectividad < 0) {
        percepcion = { tipo: 'INEFICAZ', ...estilo.ineficaz };
      }

      return {
        numero,
        nombre: estilo.nombre,
        predominio,
        efectividadSituacional,
        efectividad,
        nivelEfectividad:
          efectividad !== null ? nivelDeEfectividadCeal(efectividad) : null,
        percepcion,
      };
    });

    const puntajeGeneral = respuestas.reduce(
      (suma, r) => suma + r.efectividad,
      0,
    );
    const nivelGeneral = nivelDeEfectividadCeal(puntajeGeneral);

    const maximo = Math.max(...estilos.map((e) => e.predominio));
    const predominantes = estilos.filter((e) => e.predominio === maximo);
    const nombresPredominantes = predominantes.map((e) => e.nombre);

    const rawScores: Record<string, number> = {};
    const scaledScores: Record<string, number> = {};
    for (const estilo of estilos) {
      const clave = CLAVE_PUNTAJE_ESTILO_CEAL[estilo.numero];
      rawScores[clave] = estilo.predominio;
      if (estilo.efectividad !== null) scaledScores[clave] = estilo.efectividad;
    }
    rawScores.efectividadGeneral = puntajeGeneral;
    scaledScores.efectividadGeneral = puntajeGeneral;

    const textoPredominio =
      predominantes.length === 1
        ? `Estilo predominante: ${nombresPredominantes[0]} (${maximo} de ${totalSituaciones} respuestas)`
        : `Estilos predominantes: ${this.enumerar(nombresPredominantes)} (${maximo} de ${totalSituaciones} respuestas cada uno)`;
    const detallePredominio = estilos
      .map((e) => `${e.nombre} ${e.predominio}`)
      .join(', ');

    const descripcion =
      `Efectividad general: ${formatearEfectividadCeal(puntajeGeneral)} (${nivelGeneral}). ` +
      `${textoPredominio}. Predominio por estilo: ${detallePredominio}.`;

    this.logger.log(`CEAL: ${descripcion}`);

    return {
      rawScores,
      scaledScores,
      interpretation: {
        nivel: nivelGeneral,
        descripcion,
        resultadoResumen: `Efectividad general ${formatearEfectividadCeal(puntajeGeneral)} (${nivelGeneral})`,
        efectividadGeneral: { puntaje: puntajeGeneral, nivel: nivelGeneral },
        estilos,
        estilosPredominantes: nombresPredominantes,
        respuestas,
        referenciaTeorica: CEAL_PAUTA.referenciaTeorica,
        formula: CEAL_PAUTA.formula,
        mide: CEAL_PAUTA.mide,
        aplicacion: CEAL_PAUTA.aplicacion,
      },
    };
  }

  private enumerar(nombres: string[]): string {
    if (nombres.length <= 1) return nombres.join('');
    return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
  }

  /**
   * Sin las 12 situaciones interpretadas no hay perfil. No se informa un nivel
   * de efectividad: se dice que no se pudo calcular, para que nadie lo lea como
   * un resultado de la persona.
   */
  private resultadoNoCalculable(
    interpretadas: number,
    total: number,
  ): TestCEALScoringResult {
    return {
      rawScores: {},
      scaledScores: {},
      interpretation: {
        nivel: 'NO_DETERMINADO',
        descripcion:
          `No fue posible calcular el resultado: se interpretaron ${interpretadas} de ${total} situaciones y el CEAL requiere las ${total}. ` +
          'Este resultado NO describe a la persona y no debe usarse para evaluarla. Pídele que rinda el test nuevamente o avísale al equipo de Talentree.',
        resultadoResumen: 'No determinado',
        efectividadGeneral: null,
        estilos: [],
        estilosPredominantes: [],
        respuestas: [],
        referenciaTeorica: CEAL_PAUTA.referenciaTeorica,
        formula: CEAL_PAUTA.formula,
        mide: CEAL_PAUTA.mide,
        aplicacion: CEAL_PAUTA.aplicacion,
      },
    };
  }
}
