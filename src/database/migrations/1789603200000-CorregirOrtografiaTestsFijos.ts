import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ortografía de los tests fijos (reportada por clientes, 17-09-2026).
 *
 * Los sembradores se saltan un test que ya existe, así que corregir los
 * archivos de datos no toca las bases ya sembradas. Esta migración lleva las
 * mismas correcciones a `fixed_test_questions` y a `fixed_tests.configuration`.
 *
 * Solo cambia textos: ni claves de opción, ni puntajes, ni respuestas
 * correctas. Los resultados ya calculados no se recalculan. Es idempotente:
 * sobre un texto ya corregido no hace nada.
 *
 * Ojo al desplegar: el candidato envía el TEXTO de la opción elegida. Quien
 * esté a mitad de un 16PF o un CEAL en el momento del cambio puede enviar un
 * texto antiguo («True», «Falo»…) que el puntuador ya no reconoce. Tildes,
 * mayúsculas y espacios no afectan, porque el puntuador los normaliza.
 * Conviene correrla en un horario sin candidatos rindiendo.
 */

/** Valor completo de una opción del 16PF -> corregido. */
export const OPCIONES_16PF: Record<string, string> = {
  Si: 'Sí',
  'Si ': 'Sí',
  True: 'Verdadero',
  False: 'Falso',
  Vernadero: 'Verdadero',
  Falo: 'Falso',
  'Termino Medio': 'Término medio',
  ' Término medio': 'Término medio',
  ' NO': 'No',
  no: 'No',
  'no estoy seguro': 'No estoy seguro',
  'No Estoy Seguro': 'No estoy seguro',
  Sonreir: 'Sonreír',
  zigzag: 'Zigzag',
};

/**
 * Pares que quedaban mezclados («Verdadero … No», «Sí … Falso»).
 * [número de pregunta, clave, valor corregido]
 */
export const OPCIONES_16PF_PUNTUALES: [number, string, string][] = [
  [61, 'C', 'Falso'],
  [160, 'A', 'Verdadero'],
];

/** Fragmento -> corregido, en enunciados y opciones de cada test. */
export const FRAGMENTOS: Record<string, [string, string][]> = {
  TEST_16PF: [
    ['Estoy dispuesto (a) a', 'Estoy dispuesto(a) a'],
    [
      '¿Cuáles de las siguientes palabras es diferente',
      '¿Cuál de las siguientes palabras es diferente',
    ],
    ['la gente y su ideas', 'la gente y sus ideas'],
    ['la musica semiclásica', 'la música semiclásica'],
    ['Facilmente soy', 'Fácilmente soy'],
    ['Seria mas intere ser', 'Sería más interesante ser'],
    [
      'aunquefanfarronee o piensesn demasiado bien de si mismas',
      'aunque fanfarronee o piense demasiado bien de sí misma',
    ],
    ['se le puede nortar', 'se le puede notar'],
    ['que otro on sueldo', 'que otro con sueldo'],
    [
      'convivivieran más con la gemte de su novel',
      'convivieran más con la gente de su nivel',
    ],
    ['mirandome al espejo', 'mirándome al espejo'],
    [
      'realmete me pone furioso, suelo calmarme muey pronto',
      'realmente me pone furioso, suelo calmarme muy pronto',
    ],
    ['Preferiria tener una casa', 'Preferiría tener una casa'],
    ['Aislada en e bosque', 'Aislada en el bosque'],
    [
      '"Cansado es a "Trabajador", como Orulloso es a',
      '"Cansado" es a "Trabajador" como "Orgulloso" es a',
    ],
    ['incluso cuandi están', 'incluso cuando están'],
    ['ir a un espectaculo', 'ir a un espectáculo'],
    ['me fastiia', 'me fastidia'],
    [
      'Estano en un grupo social me siento u poco turbado si de ponto paso',
      'Estando en un grupo social me siento un poco turbado si de pronto paso',
    ],
    ['en caso contratio', 'en caso contrario'],
    ['la gente me ritica', 'la gente me critica'],
    ['adolescencia pertenecia', 'adolescencia pertenecía'],
    ['"Miedo es a', '"Miedo" es a'],
    ['tengo una iea', 'tengo una idea'],
    ['gustaba(gusta)', 'gustaba (gusta)'],
    ['no ompartido', 'no compartido'],
    ['"Delito es a', '"Delito" es a'],
    ['cosigo casi siempre', 'consigo casi siempre'],
    ['descuidado (a)', 'descuidado(a)'],
    ['alertaante los', 'alerta ante los'],
    ['organizarme andes de', 'organizarme antes de'],
    ['aunque no sé porqué', 'aunque no sé por qué'],
    ['lenguaje obceno', 'lenguaje obsceno'],
    ['a los jovenes', 'a los jóvenes'],
    ['me levanto nonámbulo', 'me levanto sonámbulo'],
    ['Atentiendo a los clientes', 'Atendiendo a los clientes'],
    ['me lo encargan a mi', 'me lo encargan a mí'],
    ['seguro (a) de que', 'seguro(a) de que'],
    ['aún cuando se pierda', 'aun cuando se pierda'],
    ['me molesnten', 'me molesten'],
    ['me dice aldo', 'me dice algo'],
    ['es diferete de', 'es diferente de'],
    ['preferriría ir', 'preferiría ir'],
    [
      'seguro de lo que voy a decir  es correcto',
      'seguro de que lo que voy a decir es correcto',
    ],
    ['pequeña cosas', 'pequeñas cosas'],
    ['Ditía cortésmente', 'Diría cortésmente'],
    ['capacidadde atención', 'capacidad de atención'],
    ['Lengua o Literatuta', 'Lengua o Literatura'],
    ['Matemáticas o Aristética', 'Matemáticas o Aritmética'],
    ['desagradables de mi sin', 'desagradables de mí sin'],
    ['más importate', 'más importante'],
    ['es mas importante', 'es más importante'],
  ],
  TEST_CEAL: [
    ['la necesidad de nuevas práctica.', 'la necesidad de nuevas prácticas.'],
    ['las relaciones jefe- subordinados.', 'las relaciones jefe - subordinados.'],
  ],
  TEST_BIS11: [
    ['velocidad Imis pensamientos', 'velocidad (mis pensamientos'],
    ['Planificomis viajes', 'Planifico mis viajes'],
    ['Se me hace dificil estar', 'Se me hace difícil estar'],
    ['piensa sin distrarse', 'piensa sin distraerse'],
    [
      'tengo que oir a alguien hablar demasido tiempo)',
      'tengo que oír a alguien hablar demasiado tiempo',
    ],
  ],
};

/** Fragmento -> corregido, dentro de `fixed_tests.configuration` y `description`. */
export const FRAGMENTOS_CONFIGURACION: Record<string, [string, string][]> = {
  TEST_CEAL: [
    ['la letra A,B,C ó D que', 'la letra A, B, C o D que'],
    [
      'aquellos cargos que tiene que cumplir',
      'aquellos cargos que tienen que cumplir',
    ],
  ],
  TEST_BIS11: [['Responsa rápida', 'Responda rápida']],
};

export function corregirTexto(codigo: string, texto: string): string {
  let corregido = texto;
  for (const [antes, despues] of FRAGMENTOS[codigo] ?? []) {
    corregido = corregido.split(antes).join(despues);
  }
  return corregido.replace(/\s{2,}/g, ' ').trim();
}

export function corregirOpciones(
  codigo: string,
  numero: number,
  opciones: Record<string, any> | null,
): Record<string, any> | null {
  // Solo las preguntas de alternativas con claves A, B, C, D. Las escalas
  // Likert, las palabras del DISC y la tabla del IC no tienen correcciones.
  if (!opciones || typeof opciones !== 'object') return opciones;

  const corregidas = { ...opciones };
  for (const clave of ['A', 'B', 'C', 'D']) {
    const valor = corregidas[clave];
    if (typeof valor !== 'string') continue;

    if (
      codigo === 'TEST_16PF' &&
      Object.prototype.hasOwnProperty.call(OPCIONES_16PF, valor)
    ) {
      corregidas[clave] = OPCIONES_16PF[valor];
    } else {
      corregidas[clave] = corregirTexto(codigo, valor);
    }
  }

  if (codigo === 'TEST_16PF') {
    for (const [n, clave, valor] of OPCIONES_16PF_PUNTUALES) {
      if (n === numero && typeof corregidas[clave] === 'string') {
        corregidas[clave] = valor;
      }
    }
  }

  return corregidas;
}

export class CorregirOrtografiaTestsFijos1789603200000
  implements MigrationInterface
{
  name = 'CorregirOrtografiaTestsFijos1789603200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const codigo of Object.keys(FRAGMENTOS)) {
      const preguntas: {
        id: string;
        question_number: number;
        question_text: string;
        options: Record<string, any> | null;
      }[] = await queryRunner.query(
        `SELECT q."id", q."question_number", q."question_text", q."options"
         FROM "fixed_test_questions" q
         INNER JOIN "fixed_tests" t ON t."id" = q."fixed_test_id"
         WHERE t."code" = $1`,
        [codigo],
      );

      let corregidas = 0;
      for (const pregunta of preguntas) {
        const texto = corregirTexto(codigo, pregunta.question_text);
        const opciones = corregirOpciones(
          codigo,
          pregunta.question_number,
          pregunta.options,
        );

        if (
          texto === pregunta.question_text &&
          JSON.stringify(opciones) === JSON.stringify(pregunta.options)
        ) {
          continue;
        }

        await queryRunner.query(
          `UPDATE "fixed_test_questions"
           SET "question_text" = $1, "options" = $2::jsonb
           WHERE "id" = $3`,
          [texto, JSON.stringify(opciones), pregunta.id],
        );
        corregidas++;
      }

      console.log(
        `[CorregirOrtografiaTestsFijos] ${codigo}: ${corregidas} de ${preguntas.length} preguntas corregidas`,
      );
    }

    // Las instrucciones y la descripción viven en `fixed_tests`. Ningún
    // fragmento lleva comillas ni barras, así que se puede reemplazar sobre el
    // JSON como texto.
    for (const [codigo, fragmentos] of Object.entries(
      FRAGMENTOS_CONFIGURACION,
    )) {
      for (const [antes, despues] of fragmentos) {
        await queryRunner.query(
          `UPDATE "fixed_tests"
           SET "configuration" = replace("configuration"::text, $1, $2)::jsonb,
               "description" = replace("description", $1, $2)
           WHERE "code" = $3`,
          [antes, despues, codigo],
        );
      }
    }
  }

  public async down(): Promise<void> {
    // No se revierte a propósito: volver atrás sería reintroducir las faltas.
  }
}
