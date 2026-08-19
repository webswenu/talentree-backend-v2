import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Un usuario puede representar a varias empresas.
 *
 * La relacion empresa-representante era @OneToOne, y eso no era solo un tipo:
 * TypeORM le pone un indice UNIQUE a `companies.user_id`. En la practica una
 * persona que es contraparte de dos empresas —un holding con dos RUT, por
 * ejemplo— tenia que inventarse una segunda cuenta con otro correo, porque el
 * email tambien es unico. Quedaba con dos logins para el mismo trabajo.
 *
 * Esta migracion hace dos cosas:
 *
 *  1. Suelta el UNIQUE de `companies.user_id`. La clave foranea se mantiene:
 *     lo que se permite es que se repita, no que apunte a cualquier parte.
 *
 *  2. Agrega `users.active_company_id`, la empresa sobre la que el usuario esta
 *     operando. El aislamiento entre empresas sigue trabajando con UNA empresa
 *     a la vez —que es el invariante que protege ownership.helper— y lo unico
 *     que cambia es quien la elige: antes la imponia el modelo, ahora la elige
 *     el usuario en un selector.
 *
 * SOBRE LA VUELTA ATRAS: el `down` se niega a correr si para entonces ya hay
 * alguien representando a dos empresas, y dice quien. Es a proposito. Revertir
 * en silencio significaria dejar la base con datos que el codigo anterior no
 * sabe leer: ese codigo resuelve la empresa del representante con un `findOne`,
 * asi que se quedaria con una cualquiera de las dos y la otra desapareceria de
 * su panel sin que nadie lo note. Que empresa se queda sin representante es una
 * decision de negocio, no algo que deba resolver una migracion.
 *
 * Lo que el `down` NO hace es reponer un UNIQUE sobre `user_id`. Suena
 * razonable, pero seria falso: al escribir esto la base no tenia ese indice
 * —el 1:1 lo sostenia el codigo, no el motor— y una vuelta atras que deja el
 * esquema MAS estricto que como estaba no es una vuelta atras. Si en algun
 * ambiente el indice si existia, el `up` lo dejo anotado en el log al
 * borrarlo.
 */
export class AllowUserToRepresentManyCompanies1771286400000
  implements MigrationInterface
{
  name = 'AllowUserToRepresentManyCompanies1771286400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
     * El nombre del indice lo genero `synchronize` (algo tipo "REL_<hash>" o
     * "UQ_<hash>"), asi que no se puede escribir a mano sin arriesgarse a que
     * en la base de la clienta se llame distinto que en la de desarrollo. Se
     * busca por catalogo: cualquier constraint UNIQUE que cubra exactamente la
     * columna user_id de companies.
     */
    const constraints: Array<{ conname: string }> = await queryRunner.query(`
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE rel.relname = 'companies'
        AND con.contype = 'u'
        AND con.conkey = ARRAY[(
          SELECT attnum FROM pg_attribute
          WHERE attrelid = rel.oid AND attname = 'user_id'
        )]::smallint[]
    `);

    for (const { conname } of constraints) {
      // Se deja en el log: es el unico rastro de que este ambiente si tenia el
      // indice, y el `down` no lo repone (ver la nota de la cabecera).
      console.log(
        `[migración] companies: se elimina el UNIQUE "${conname}" sobre user_id`,
      );
      await queryRunner.query(
        `ALTER TABLE "companies" DROP CONSTRAINT "${conname}"`,
      );
    }

    // Un indice unico suelto (no respaldado por constraint) tambien bloquearia.
    const indexes: Array<{ indexname: string }> = await queryRunner.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'companies'
        AND indexdef ILIKE '%UNIQUE%'
        AND indexdef ILIKE '%(user_id)%'
    `);

    for (const { indexname } of indexes) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${indexname}"`);
    }

    // Indice no unico: las consultas por representante siguen existiendo.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_companies_user_id" ON "companies" ("user_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "active_company_id" uuid`,
    );

    /**
     * Se apunta a la empresa que ya representaban, para que la sesion siga
     * mostrando exactamente lo mismo que antes del cambio. Sin esto, al primer
     * ingreso el panel abriria vacio hasta que la persona toque el selector.
     */
    await queryRunner.query(`
      UPDATE "users" u
      SET "active_company_id" = c."id"
      FROM "companies" c
      WHERE c."user_id" = u."id"
        AND u."active_company_id" IS NULL
    `);

    /**
     * Si la empresa activa se borra, el puntero queda en null y la sesion cae
     * en la primera empresa que le quede al usuario. Sin esto quedaria
     * apuntando a una empresa inexistente.
     */
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_active_company"
      FOREIGN KEY ("active_company_id") REFERENCES "companies"("id")
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Se comprueba ANTES de tocar nada: si hay que abortar, la base tiene que
    // quedar exactamente como estaba, no a medio revertir.
    const duplicados: Array<{ email: string; empresas: string }> =
      await queryRunner.query(`
        SELECT u."email", string_agg(c."name", ', ' ORDER BY c."name") AS empresas
        FROM "companies" c
        JOIN "users" u ON u."id" = c."user_id"
        WHERE c."user_id" IS NOT NULL
        GROUP BY u."email"
        HAVING count(*) > 1
      `);

    if (duplicados.length > 0) {
      const lineas = [
        'No se puede revertir: hay representantes con mas de una empresa, y el',
        'código anterior solo sabe leer una.',
        '',
        ...duplicados.map((d) => `  - ${d.email}: ${d.empresas}`),
        '',
        'Decide primero que empresa conserva cada uno y deja las otras sin',
        'representante (o asignales otro) antes de revertir.',
      ];

      throw new Error(lineas.join('\n'));
    }

    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_active_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "active_company_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_companies_user_id"`);
  }
}
