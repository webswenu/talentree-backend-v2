import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BIS-11: la escala pasa de 0-1-3-4 a 1-2-3-4 (20-11-2026).
 *
 * El total se clasificaba contra 63,88 ± 11,32, una media obtenida con
 * puntuación 1-2-3-4, pero las respuestas se puntuaban 0-1-3-4: una misma
 * persona sacaba 25 a 28 puntos menos y casi todos caían en «Bajo».
 *
 * El puntuador lee la escala desde `bis11.data.ts`, no desde la base. Esta
 * migración solo alinea lo que quedó sembrado en `fixed_tests.configuration`
 * (la escala y la nota de tabulación), para que nadie lea en la base una
 * escala distinta de la que se aplica. No recalcula resultados ya guardados.
 * Es idempotente.
 */
const ESCALA_NUEVA = [
  { clave: 'A', texto: 'Raramente o nunca', valor: 1 },
  { clave: 'B', texto: 'Ocasionalmente', valor: 2 },
  { clave: 'C', texto: 'A menudo', valor: 3 },
  { clave: 'D', texto: 'Siempre o casi siempre', valor: 4 },
];

const ESCALA_ANTIGUA = [
  { clave: 'A', texto: 'Raramente o nunca', valor: 0 },
  { clave: 'B', texto: 'Ocasionalmente', valor: 1 },
  { clave: 'C', texto: 'A menudo', valor: 3 },
  { clave: 'D', texto: 'Siempre o casi siempre', valor: 4 },
];

const NOTA_NUEVA =
  'Puntaje corregido = aplica puntuación inversa a los ítems 1, 5, 6, 7, 8, 10, 11, 13, 17, 19, 22 y 30 (escala 1-2-3-4; puntaje corregido = 5 - respuesta). El total va de 30 a 120. El nivel del TOTAL se calcula contra una referencia poblacional publicada (media=63.88, DT=11.32; adaptación española BIS-11, n=703), obtenida con la misma escala 1-2-3-4. El nivel de cada subescala es una estimación aproximada por tercios de su rango posible (del mínimo al máximo), sin normas poblacionales equivalentes. Un total menor a 41 (media - 2 DT) se marca como posible respuesta orientada a la deseabilidad social.';

const NOTA_ANTIGUA =
  'Puntaje corregido = aplica puntuación inversa a los ítems 1, 5, 6, 7, 8, 10, 11, 13, 17, 19, 22 y 30 (escala 0-1-3-4). El nivel del TOTAL se calcula contra una referencia poblacional publicada (media=63.88, DT=11.32; adaptación española BIS-11, n=703). El nivel de cada subescala es una estimación aproximada por tercios de su puntaje posible, sin normas poblacionales equivalentes.';

export class Bis11Escala12341795219200000 implements MigrationInterface {
  name = 'Bis11Escala12341795219200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.aplicar(queryRunner, ESCALA_NUEVA, NOTA_NUEVA);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.aplicar(queryRunner, ESCALA_ANTIGUA, NOTA_ANTIGUA);
  }

  private async aplicar(
    queryRunner: QueryRunner,
    escala: typeof ESCALA_NUEVA,
    nota: string,
  ): Promise<void> {
    // La nota es el segundo texto de `instructions` (el primero es la
    // instrucción al candidato). Si la forma no es esa, no se toca.
    await queryRunner.query(
      `UPDATE fixed_tests
          SET configuration = jsonb_set(
                jsonb_set(configuration, '{escala}', $1::jsonb),
                '{instructions,1}', to_jsonb($2::text))
        WHERE code = 'TEST_BIS11'
          AND jsonb_typeof(configuration->'instructions') = 'array'
          AND jsonb_array_length(configuration->'instructions') >= 2`,
      [JSON.stringify(escala), nota],
    );
  }
}
