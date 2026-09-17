import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Errores de contenido encontrados en el barrido ortográfico del 17-09-2026.
 *
 * IL: dos claves malas. Pregunta 1 (20 min + el doble = 60 min) y pregunta 5
 * (lunes + 10 días = jueves) tenían «C» como correcta; es «D» en ambas. Con
 * eso el máximo alcanzable respondiendo bien era 18 de 20.
 *
 * 16PF: la analogía de la pregunta 22 decía «Trabajador» por «Trabajar», y la
 * opción B de la 31 decía «No estoy de acuerdo» por «No estoy seguro» (quedaba
 * entre «De acuerdo» y «En desacuerdo»). Ni claves ni puntajes del 16PF cambian.
 *
 * Los IL ya rendidos NO se recalculan aquí. Cada UPDATE exige el valor
 * antiguo, así que es idempotente.
 *
 * OJO: en un archivo de migración solo se exporta la clase. TypeORM instancia
 * toda función exportada como si fuera una migración.
 */
export class CorregirClavesILyItems16PF1789606800000
  implements MigrationInterface
{
  name = 'CorregirClavesILyItems16PF1789606800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const claves = await queryRunner.query(
      `UPDATE "fixed_test_questions" q
       SET "correct_answer" = '{"answer": "D"}'::jsonb
       FROM "fixed_tests" t
       WHERE t."id" = q."fixed_test_id"
         AND t."code" = 'TEST_IL'
         AND q."question_number" IN (1, 5)
         AND q."correct_answer"->>'answer' = 'C'`,
    );

    const analogia = await queryRunner.query(
      `UPDATE "fixed_test_questions" q
       SET "question_text" = replace(q."question_text", '"Trabajador"', '"Trabajar"')
       FROM "fixed_tests" t
       WHERE t."id" = q."fixed_test_id"
         AND t."code" = 'TEST_16PF'
         AND q."question_number" = 22
         AND q."question_text" LIKE '%"Trabajador"%'`,
    );

    const opcion = await queryRunner.query(
      `UPDATE "fixed_test_questions" q
       SET "options" = jsonb_set(q."options", '{B}', '"No estoy seguro"'::jsonb)
       FROM "fixed_tests" t
       WHERE t."id" = q."fixed_test_id"
         AND t."code" = 'TEST_16PF'
         AND q."question_number" = 31
         AND q."options"->>'B' = 'No estoy de acuerdo'`,
    );

    const filas = (r: unknown) => (Array.isArray(r) ? r[1] ?? 0 : 0);
    console.log(
      `[CorregirClavesILyItems16PF] claves IL: ${filas(claves)}, 16PF 22: ${filas(analogia)}, 16PF 31: ${filas(opcion)}`,
    );
  }

  public async down(): Promise<void> {
    // No se revierte a propósito: volver atrás sería reintroducir los errores.
  }
}
