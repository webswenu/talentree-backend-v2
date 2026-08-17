import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P-40. Arreglo de datos históricos.
 *
 * Las postulaciones creadas al aceptar una invitación quedaban sin
 * `appliedAt`, porque `acceptById` no lo asignaba (la postulación normal sí).
 * En la tabla de candidatos esas filas mostraban la fecha vacía y no se podían
 * ordenar por antigüedad.
 *
 * El defecto ya está corregido en el código, pero los registros que se crearon
 * antes siguen con el campo nulo. Se rellenan con `created_at`, que es el
 * momento real en que se creó la postulación.
 */
export class BackfillAppliedAt1763900000000 implements MigrationInterface {
  name = 'BackfillAppliedAt1763900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const resultado = await queryRunner.query(`
      UPDATE "worker_processes"
      SET "appliedAt" = "created_at"::date
      WHERE "appliedAt" IS NULL
    `);

    console.log(
      `[BackfillAppliedAt] Postulaciones con fecha rellenada: ${
        Array.isArray(resultado) ? resultado[1] ?? 0 : 0
      }`,
    );
  }

  public async down(): Promise<void> {
    // No se revierte a proposito: volver a poner los campos en nulo
    // reintroduciría el defecto y no hay forma de distinguir cuáles estaban
    // nulos originalmente de los que se rellenaron aquí.
  }
}
