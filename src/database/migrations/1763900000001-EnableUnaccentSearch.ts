import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P-37. La búsqueda no ignoraba acentos ni la ñ.
 *
 * Buscar "Munoz" no encontraba a "Muñoz", ni "Jose" a "José", ni "Antofagasta"
 * escrito sin tilde en donde correspondía. En Chile eso no es un caso raro: es
 * como la gente escribe cuando busca rápido, y el resultado era que el
 * administrador concluía que el registro no existía.
 *
 * `unaccent` es una extensión estándar de PostgreSQL (viene en contrib), así
 * que no agrega una dependencia nueva al despliegue.
 *
 * Los índices sobre la expresión son necesarios: sin ellos, envolver la
 * columna en una función impide usar cualquier índice normal y cada búsqueda
 * se convierte en un recorrido completo de la tabla. Van marcados IMMUTABLE a
 * través de una función propia porque `unaccent` es STABLE, y PostgreSQL no
 * permite indexar expresiones que no sean inmutables.
 */
export class EnableUnaccentSearch1763900000001 implements MigrationInterface {
  name = 'EnableUnaccentSearch1763900000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);

    // Envoltorio inmutable: requisito para poder indexar la expresión.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION immutable_unaccent(text)
      RETURNS text AS $$
        SELECT public.unaccent('public.unaccent'::regdictionary, $1)
      $$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
    `);

    // OJO: el nombre de las columnas NO es uniforme entre tablas. `users` usa
    // snake_case (first_name) y `workers` camelCase entre comillas
    // ("firstName"), porque cada entidad declara el suyo. Verificado contra
    // information_schema, no deducido de las entidades.
    const indices: Array<[string, string, string[]]> = [
      ['idx_users_search', 'users', ['first_name', 'last_name', 'email']],
      ['idx_workers_search', 'workers', ['"firstName"', '"lastName"', 'email']],
      ['idx_companies_search', 'companies', ['name', 'industry', 'city']],
      ['idx_processes_search', 'selection_processes', ['name', '"position"']],
    ];

    for (const [nombre, tabla, columnas] of indices) {
      for (const [i, columna] of columnas.entries()) {
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "${nombre}_${i}"
          ON "${tabla}" (lower(immutable_unaccent(${columna})) text_pattern_ops)
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const indices = [
      'idx_users_search',
      'idx_workers_search',
      'idx_companies_search',
      'idx_processes_search',
    ];

    for (const nombre of indices) {
      for (let i = 0; i < 3; i++) {
        await queryRunner.query(`DROP INDEX IF EXISTS "${nombre}_${i}"`);
      }
    }

    await queryRunner.query(`DROP FUNCTION IF EXISTS immutable_unaccent(text)`);
    // La extensión no se elimina: puede estar en uso por otra cosa.
  }
}
