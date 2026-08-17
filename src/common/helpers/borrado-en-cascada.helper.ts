import { EntityManager } from 'typeorm';

/**
 * Borrado en cascada de procesos y empresas.
 *
 * POR QUÉ EXISTE: la clienta pidió poder eliminar una empresa aunque tenga
 * procesos, y un proceso aunque tenga candidatos. Antes ambos casos se
 * bloqueaban, porque tres tablas referencian a `selection_processes` con
 * `NO ACTION` (`worker_processes`, `reports` y `process_invitations`), así que
 * cualquier proceso con un solo postulante era imposible de borrar.
 *
 * POR QUÉ ES DELICADO: al borrar un proceso se van con él las postulaciones,
 * las respuestas de los tests y los INFORMES PSICOTÉCNICOS de personas reales.
 * Nada de eso se recupera. Por eso el borrado va en una transacción —o se hace
 * todo o no se hace nada— y existe `contarImpacto()`, para que la pantalla
 * pueda decir exactamente qué va a desaparecer ANTES de confirmar.
 *
 * El orden importa: se borra siempre de la hoja hacia la raíz.
 */

export interface ImpactoBorrado {
  procesos: number;
  postulaciones: number;
  respuestasDeTest: number;
  informes: number;
  invitaciones: number;
  /** Candidatos distintos afectados: es el número que importa a una persona. */
  candidatosAfectados: number;
}

const VACIO: ImpactoBorrado = {
  procesos: 0,
  postulaciones: 0,
  respuestasDeTest: 0,
  informes: 0,
  invitaciones: 0,
  candidatosAfectados: 0,
};

/** Qué se destruiría al borrar estos procesos. Solo cuenta, no modifica nada. */
export async function contarImpacto(
  em: EntityManager,
  processIds: string[],
): Promise<ImpactoBorrado> {
  if (processIds.length === 0) return { ...VACIO };

  const uno = async (sql: string): Promise<number> => {
    const r = await em.query(sql, [processIds]);
    return parseInt(r?.[0]?.n ?? '0', 10) || 0;
  };

  return {
    procesos: processIds.length,
    postulaciones: await uno(
      'SELECT count(*) AS n FROM worker_processes WHERE process_id = ANY($1)',
    ),
    respuestasDeTest: await uno(
      `SELECT count(*) AS n FROM test_responses
       WHERE worker_process_id IN (
         SELECT id FROM worker_processes WHERE process_id = ANY($1))`,
    ),
    informes: await uno(
      'SELECT count(*) AS n FROM reports WHERE process_id = ANY($1)',
    ),
    invitaciones: await uno(
      'SELECT count(*) AS n FROM process_invitations WHERE process_id = ANY($1)',
    ),
    candidatosAfectados: await uno(
      'SELECT count(DISTINCT worker_id) AS n FROM worker_processes WHERE process_id = ANY($1)',
    ),
  };
}

/**
 * Borra los procesos indicados y todo lo que cuelga de ellos.
 * Debe llamarse DENTRO de una transacción.
 */
export async function borrarProcesosEnCascada(
  em: EntityManager,
  processIds: string[],
): Promise<void> {
  if (processIds.length === 0) return;

  // De la hoja a la raíz. Las respuestas de test cuelgan de las postulaciones,
  // así que van antes; las respuestas individuales cuelgan de las respuestas
  // de test y se borran por su propia cascada.
  await em.query(
    `DELETE FROM test_answers
     WHERE test_response_id IN (
       SELECT tr.id FROM test_responses tr
       JOIN worker_processes wp ON wp.id = tr.worker_process_id
       WHERE wp.process_id = ANY($1))`,
    [processIds],
  );

  await em.query(
    `DELETE FROM test_responses
     WHERE worker_process_id IN (
       SELECT id FROM worker_processes WHERE process_id = ANY($1))`,
    [processIds],
  );

  // Los informes se borran antes que las postulaciones porque pueden
  // referenciar ambas cosas.
  await em.query('DELETE FROM reports WHERE process_id = ANY($1)', [
    processIds,
  ]);

  await em.query(
    'DELETE FROM process_invitations WHERE process_id = ANY($1)',
    [processIds],
  );

  await em.query('DELETE FROM worker_processes WHERE process_id = ANY($1)', [
    processIds,
  ]);

  // El resto de las tablas que apuntan al proceso ya están en CASCADE
  // (process_evaluators, process_tests, process_fixed_tests,
  // process_video_requirements, worker_video_requirements).
  await em.query('DELETE FROM selection_processes WHERE id = ANY($1)', [
    processIds,
  ]);
}
