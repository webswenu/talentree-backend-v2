import dataSource from '../config/typeorm.config';

/**
 * Pone al dia la tabla `migrations` en una base que se construyo con
 * `synchronize`, para poder pasar a trabajar con migraciones.
 *
 * EL PROBLEMA QUE RESUELVE
 *
 * Esta base nunca corrio una migracion: el esquema lo fue armando TypeORM solo,
 * leyendo las entidades en cada arranque (`DB_SYNCHRONIZE=true`). Por eso no
 * existe la tabla `migrations`, y por eso `migration:run` es peligroso tal cual:
 * al no encontrar registro de nada, intenta aplicar las ocho migraciones desde
 * cero contra un esquema que YA tiene sus efectos. La primera que se topa con
 * `CREATE TABLE "fixed_tests"` o `ALTER TABLE "reports" ADD "status"` falla,
 * porque esas cosas ya estan ahi.
 *
 * COMO LO RESUELVE
 *
 * No se ejecuta ninguna migracion aqui. Para cada una se hace una pregunta
 * concreta a la base —¿existe la tabla?, ¿existe la columna?— y solo si la
 * respuesta es que si, se la anota como aplicada. Las que no dejaron rastro
 * quedan pendientes y las aplica `migration:run` normalmente.
 *
 * La comprobacion es por EFECTO y no por fecha a proposito: marcar por fecha
 * seria adivinar, y una migracion mal marcada como aplicada es un cambio de
 * esquema que no va a ocurrir nunca y que nadie va a notar hasta que algo falle
 * lejos de aqui.
 *
 * Es seguro correrlo mas de una vez: lo ya registrado se deja quieto.
 *
 *   npm run migration:baseline
 *   npm run migration:run
 */

interface MigracionPreexistente {
  /** Igual al `name` de la clase de la migracion. TypeORM compara por esto. */
  nombre: string;
  /** El numero del nombre del archivo. */
  timestamp: number;
  /** Que mirar para saber si su efecto ya esta en la base. */
  sonda: string;
  /** Que dejo esta migracion, para el mensaje en pantalla. */
  descripcion: string;
}

/**
 * Solo van aqui las migraciones que NO se pueden repetir sin fallar.
 *
 * Quedan deliberadamente fuera dos que si son idempotentes, porque volver a
 * correrlas no cuesta nada y es preferible a arriesgarse a saltarlas:
 *
 *  - BackfillAppliedAt1763900000000  -> su UPDATE filtra por "IS NULL"
 *  - EnableUnaccentSearch1763900000001 -> usa IF NOT EXISTS / OR REPLACE
 */
const MIGRACIONES_PREEXISTENTES: MigracionPreexistente[] = [
  {
    nombre: 'AddFixedTestsFeature1730400000000',
    timestamp: 1730400000000,
    sonda: `SELECT to_regclass('public.fixed_tests') IS NOT NULL AS presente`,
    descripcion: 'tablas de tests fijos',
  },
  {
    nombre: 'AddStatusToReports1762261073457',
    timestamp: 1762261073457,
    sonda: `SELECT EXISTS(
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'reports' AND column_name = 'status'
            ) AS presente`,
    descripcion: 'reports.status',
  },
  {
    nombre: 'AddProcessVideoRequirements1762525097675',
    timestamp: 1762525097675,
    sonda: `SELECT to_regclass('public.process_video_requirements') IS NOT NULL AS presente`,
    descripcion: 'tabla process_video_requirements',
  },
  {
    nombre: 'AddOnDeleteSetNullToWorkerUser1763130906003',
    timestamp: 1763130906003,
    // confdeltype: 'n' = SET NULL, 'c' = CASCADE, 'a' = NO ACTION.
    sonda: `SELECT EXISTS(
              SELECT 1 FROM pg_constraint
              WHERE conname = 'FK_e47e873d6f19443891cca73bd8c'
                AND confdeltype = 'n'
            ) AS presente`,
    descripcion: 'workers.user_id con ON DELETE SET NULL',
  },
  {
    nombre: 'AddStatusToTestResponse1763650898510',
    timestamp: 1763650898510,
    sonda: `SELECT EXISTS(
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'test_responses' AND column_name = 'status'
            ) AS presente`,
    descripcion: 'test_responses.status',
  },
];

async function main() {
  await dataSource.initialize();
  const qr = dataSource.createQueryRunner();

  try {
    // La crea TypeORM en su primera corrida; aqui hace falta antes.
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "migrations" (
        "id" SERIAL NOT NULL,
        "timestamp" bigint NOT NULL,
        "name" character varying NOT NULL,
        CONSTRAINT "PK_migrations_id" PRIMARY KEY ("id")
      )
    `);

    const yaRegistradas: Array<{ name: string }> = await qr.query(
      `SELECT name FROM "migrations"`,
    );
    const registradas = new Set(yaRegistradas.map((m) => m.name));

    let marcadas = 0;
    let pendientes = 0;
    let omitidas = 0;

    console.log('\nRevisando migraciones preexistentes:\n');

    for (const m of MIGRACIONES_PREEXISTENTES) {
      if (registradas.has(m.nombre)) {
        console.log(`  =  ${m.nombre}\n     ya estaba registrada`);
        omitidas++;
        continue;
      }

      const [{ presente }] = await qr.query(m.sonda);

      if (presente) {
        await qr.query(
          `INSERT INTO "migrations" ("timestamp", "name") VALUES ($1, $2)`,
          [m.timestamp, m.nombre],
        );
        console.log(
          `  OK ${m.nombre}\n     ${m.descripcion} ya esta en la base -> se marca como aplicada`,
        );
        marcadas++;
      } else {
        console.log(
          `  !  ${m.nombre}\n     ${m.descripcion} NO esta en la base -> queda pendiente, la aplicara migration:run`,
        );
        pendientes++;
      }
    }

    console.log(
      `\nResumen: ${marcadas} marcada(s) como aplicada(s), ` +
        `${pendientes} pendiente(s), ${omitidas} ya registrada(s).`,
    );
    console.log('\nAhora si: npm run migration:run\n');
  } finally {
    await qr.release();
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('\nEl baseline fallo y no se aplico nada:\n', error);
  process.exit(1);
});
