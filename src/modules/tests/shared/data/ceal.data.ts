/**
 * CEAL — Cuestionario de la Efectividad y Adaptabilidad del Líder.
 *
 * Fuente: `CEAL-Test-y-tabulacion-de-CEAL.doc` (cuadernillo, hoja de respuesta,
 * pauta de corrección y feedback de resultados). Este archivo lo generó un
 * script a partir del documento: los textos van tal cual, sin corregir.
 *
 * La clave (`clave`) es la del bloque «Alternativa de acción» de la hoja de
 * respuesta: para cada letra, el número de arriba a la izquierda es el estilo y
 * el de abajo a la derecha la efectividad. Se cotejó celda por celda (96 de 96)
 * contra el LEAD original de Hersey y Blanchard, del que el CEAL es la
 * adaptación.
 *
 * Es la única fuente de verdad: el sembrador toma de aquí los textos y el
 * puntuador la clave. La clave NO se guarda en la base, porque la pregunta
 * completa viaja al navegador del candidato.
 */

export type LetraCeal = 'A' | 'B' | 'C' | 'D';
export type NumeroEstiloCeal = 1 | 2 | 3 | 4;

export interface SituacionCeal {
  numero: number;
  texto: string;
  alternativas: Record<LetraCeal, string>;
  clave: Record<LetraCeal, { estilo: NumeroEstiloCeal; efectividad: number }>;
}

export interface EstiloCeal {
  numero: NumeroEstiloCeal;
  nombre: string;
  /** Cómo es percibido cuando el estilo no responde a la situación. */
  ineficaz: { nombre: string; descripcion: string };
  /** Cómo es percibido cuando el estilo responde a la situación. */
  eficaz: { nombre: string; descripcion: string };
}

export const CEAL_INSTRUCCIONES: string[] = [
  'Esta prueba consta de 12 situaciones.',
  'LEA cada situación atentamente y piense lo que Ud. haría en cada circunstancia.',
  'MARQUE en su hoja de respuesta la letra de la alternativa que, según Ud., describe mejor su comportamiento en la situación que se presenta.',
  'MARQUE SOLO UNA ALTERNATIVA',
  'Debe marcar la elección para cada situación en la hoja de respuestas, colocando la letra A,B,C ó D que, según su opinión, describe mejor su comportamiento de líder. Escriba la letra correspondiente en los casilleros superiores numerados del 1 al 12.',
  'No deje ninguna pregunta sin responder.',
  'Responda con sinceridad y espontaneidad.',
  'No raye el cuadernillo.',
  'Es una prueba sin tiempo',
];

export const CEAL_ENUNCIADO =
  'Indique cuál de las alternativas representa la respuesta que Ud. preferiría ante cada situación:';

export const CEAL_SITUACIONES: SituacionCeal[] = [
  {
    numero: 1,
    texto:
      'Sus subordinados no han estado respondiendo a su conversación amistosa y a su obvio interés por el bienestar de ellos. El rendimiento del grupo se ha mantenido bajo.',
    alternativas: {
      A: 'Enfatizo el uso de procedimientos uniformes y la necesidad del cumplimiento de las tareas.',
      B: 'Estoy disponible para la discusión, pero presiono.',
      C: 'Hablo con los subordinados y luego establezco objetivos.',
      D: 'Me cuido de no intervenir.',
    },
    clave: {
      A: {
        estilo: 1,
        efectividad: 2,
      },
      B: {
        estilo: 3,
        efectividad: -1,
      },
      C: {
        estilo: 2,
        efectividad: 1,
      },
      D: {
        estilo: 4,
        efectividad: -2,
      },
    },
  },
  {
    numero: 2,
    texto:
      'El rendimiento observable de su grupo está aumentando, Ud. se ha preocupado de que todos los miembros estén conscientes de sus funciones y normas.',
    alternativas: {
      A: 'Me comprometo a la interacción amistosa, pero continúo asegurándome de que todos los miembros estén conscientes de sus funciones y normas de rendimiento.',
      B: 'No ejecuto ninguna acción definida.',
      C: 'Hago lo que puedo para que el grupo se sienta importante y comprometido.',
      D: 'Enfatizo la importancia de las tareas y sus plazos.',
    },
    clave: {
      A: {
        estilo: 2,
        efectividad: 2,
      },
      B: {
        estilo: 4,
        efectividad: -2,
      },
      C: {
        estilo: 3,
        efectividad: 1,
      },
      D: {
        estilo: 1,
        efectividad: -1,
      },
    },
  },
  {
    numero: 3,
    texto:
      'Los miembros de su grupo se muestran incapaces de resolver un problema por su cuenta. Normalmente Ud. los ha dejado solos. El rendimiento y las relaciones interpersonales del grupo han estado buenas.',
    alternativas: {
      A: 'Comprometo al grupo y juntos tratamos de resolver el problema.',
      B: 'Dejo que el grupo lo resuelva.',
      C: 'Actúo rápida y firmemente para corregir y reorientar.',
      D: 'Estimulo al grupo para que trabaje en el problema y estoy disponible para la discusión.',
    },
    clave: {
      A: {
        estilo: 2,
        efectividad: 1,
      },
      B: {
        estilo: 4,
        efectividad: -1,
      },
      C: {
        estilo: 1,
        efectividad: -2,
      },
      D: {
        estilo: 3,
        efectividad: 2,
      },
    },
  },
  {
    numero: 4,
    texto:
      'Ud. está considerando un gran cambio. Sus subordinados tienen una buena historia de rendimiento. Ellos están de acuerdo con la necesidad de cambio.',
    alternativas: {
      A: 'Permito que el grupo participe en el desarrollo del cambio, pero no presiono.',
      B: 'Anuncio los cambios y los implemento con una supervisión estrecha.',
      C: 'Permito que el grupo formule su propia dirección.',
      D: 'Incorporo las recomendaciones del grupo pero dirijo el cambio.',
    },
    clave: {
      A: {
        estilo: 3,
        efectividad: 1,
      },
      B: {
        estilo: 1,
        efectividad: -2,
      },
      C: {
        estilo: 4,
        efectividad: 2,
      },
      D: {
        estilo: 2,
        efectividad: -1,
      },
    },
  },
  {
    numero: 5,
    texto:
      'El rendimiento de su grupo ha estado bajando en los últimos meses. Los miembros se han mostrado indiferentes con el cumplimiento de los objetivos propuestos. Continuamente ha sido necesario recordarles que hagan sus tareas a tiempo. En el pasado, el redefinir las funciones ha sido una ayuda.',
    alternativas: {
      A: 'Permito que el grupo formule su propia dirección.',
      B: 'Acojo recomendaciones del grupo, pero veo que se cumplan los objetivos.',
      C: 'Redefino los objetivos y superviso cuidadosamente.',
      D: 'Permito que el grupo participe en la definición de los objetivos, pero no presiono.',
    },
    clave: {
      A: {
        estilo: 4,
        efectividad: -2,
      },
      B: {
        estilo: 2,
        efectividad: 1,
      },
      C: {
        estilo: 1,
        efectividad: 2,
      },
      D: {
        estilo: 3,
        efectividad: -1,
      },
    },
  },
  {
    numero: 6,
    texto:
      'Ud. se incorporó a una situación manejada eficientemente. El administrador anterior era muy exigente. Ud. quiere mantener una situación productiva pero le gustaría comenzar a humanizar el ambiente.',
    alternativas: {
      A: 'Hago lo que puedo para que el grupo se sienta importante y comprometido.',
      B: 'Enfatizo la importancia de las tareas y sus plazos.',
      C: 'Me cuido de no intervenir.',
      D: 'Hago que el grupo se comprometa en la toma de decisiones, pero veo que los objetivos se cumplan.',
    },
    clave: {
      A: {
        estilo: 3,
        efectividad: -1,
      },
      B: {
        estilo: 1,
        efectividad: 1,
      },
      C: {
        estilo: 4,
        efectividad: -2,
      },
      D: {
        estilo: 2,
        efectividad: 2,
      },
    },
  },
  {
    numero: 7,
    texto:
      'Ud. está considerando la posibilidad de realizar cambios mayores en la estructura de su organización. Los miembros del grupo han hecho algunas sugerencias acerca del cambio necesario. El grupo ha demostrado flexibilidad en sus operaciones diarias.',
    alternativas: {
      A: 'Defino el cambio y superviso cuidadosamente.',
      B: 'Obtengo sugerencias del grupo sobre el cambio y permito que los miembros organicen la implementación.',
      C: 'Me muestro dispuesto a realizar los cambios recomendados, pero mantengo el control de la implementación.',
      D: 'Evito la confrontación: dejo las cosas solas.',
    },
    clave: {
      A: {
        estilo: 1,
        efectividad: -2,
      },
      B: {
        estilo: 3,
        efectividad: 2,
      },
      C: {
        estilo: 2,
        efectividad: -1,
      },
      D: {
        estilo: 4,
        efectividad: 1,
      },
    },
  },
  {
    numero: 8,
    texto:
      'El rendimiento del grupo y las relaciones interpersonales son buenas. Ud. se siente inseguro acerca de cómo está dirigiendo el grupo.',
    alternativas: {
      A: 'Dejo al grupo solo.',
      B: 'Discuto la situación con el grupo y luego inicio los cambios necesarios.',
      C: 'Doy algunos pasos para dirigir a mis subordinados para que trabajen de una manera bien definida.',
      D: 'Tengo cuidado de no dañar las relaciones jefe - subordinados, siendo demasiado directivo.',
    },
    clave: {
      A: {
        estilo: 4,
        efectividad: 2,
      },
      B: {
        estilo: 2,
        efectividad: -1,
      },
      C: {
        estilo: 1,
        efectividad: -2,
      },
      D: {
        estilo: 3,
        efectividad: 1,
      },
    },
  },
  {
    numero: 9,
    texto:
      'Su superior le ha asignado la dirección de una tarea fuera del horario de trabajo, haciendo las recomendaciones requeridas para el cambio. El grupo no tiene claro sus objetivos. La asistencia a reuniones de trabajo ha estado pobre. Las sesiones se han transformado en reuniones sociales. Potencialmente el grupo tiene el talento necesario para ayudar.',
    alternativas: {
      A: 'Dejo que el grupo lo resuelva.',
      B: 'Incorporo las recomendaciones del grupo, pero veo que los objetivos se cumplan.',
      C: 'Redefino los objetivos y superviso cuidadosamente.',
      D: 'Permito que el grupo se comprometa estableciendo objetivos, pero no presiono.',
    },
    clave: {
      A: {
        estilo: 4,
        efectividad: -2,
      },
      B: {
        estilo: 2,
        efectividad: 1,
      },
      C: {
        estilo: 1,
        efectividad: 2,
      },
      D: {
        estilo: 3,
        efectividad: -1,
      },
    },
  },
  {
    numero: 10,
    texto:
      'Sus subordinados, generalmente capaces de asumir responsabilidades, no están respondiendo a su reciente redefinición de las normas.',
    alternativas: {
      A: 'Permito que el grupo se comprometa en la redefinición de las normas, pero no presiono.',
      B: 'Redefino las normas y superviso cuidadosamente.',
      C: 'Evito la confrontación, no presionando.',
      D: 'Incorporo recomendaciones del grupo, pero veo que se cumplan las nuevas normas.',
    },
    clave: {
      A: {
        estilo: 3,
        efectividad: 1,
      },
      B: {
        estilo: 1,
        efectividad: -2,
      },
      C: {
        estilo: 4,
        efectividad: -1,
      },
      D: {
        estilo: 2,
        efectividad: 2,
      },
    },
  },
  {
    numero: 11,
    texto:
      'Ud. ha sido promovido a una nueva posición. El supervisor anterior no estaba comprometido con los asuntos del grupo. El grupo ha manejado adecuadamente sus tareas y ese estilo de dirección. Las relaciones en el grupo son buenas.',
    alternativas: {
      A: 'Doy pasos para dirigir a los subordinados a trabajar de una manera bien definida.',
      B: 'Comprometo a los subordinados en la toma de decisiones y refuerzo las buenas contribuciones.',
      C: 'Discuto el rendimiento pasado con el grupo y luego examino la necesidad de nuevas prácticas.',
      D: 'Continúo dejando al grupo solo.',
    },
    clave: {
      A: {
        estilo: 1,
        efectividad: -2,
      },
      B: {
        estilo: 3,
        efectividad: 2,
      },
      C: {
        estilo: 2,
        efectividad: -1,
      },
      D: {
        estilo: 4,
        efectividad: 1,
      },
    },
  },
  {
    numero: 12,
    texto:
      'La información reciente indica la existencia de dificultades internas entre los subordinados. El grupo tiene una historia de excelentes logros. Los miembros han mantenido en forma efectiva los objetivos a largo plazo y han trabajado en armonía todo el año anterior. Todos están bien calificados para sus tareas.',
    alternativas: {
      A: 'Pruebo una solución mía con los subordinados, mientras reviso la necesidad de nuevas práctica.',
      B: 'Permito a los miembros del grupo que lo resuelvan por sí mismos.',
      C: 'Actúo rápida y firmemente para corregir y reorientar.',
      D: 'Estoy disponible para la discusión, pero tengo cuidado de no dañar las relaciones jefe- subordinados.',
    },
    clave: {
      A: {
        estilo: 2,
        efectividad: -1,
      },
      B: {
        estilo: 4,
        efectividad: 2,
      },
      C: {
        estilo: 1,
        efectividad: -2,
      },
      D: {
        estilo: 3,
        efectividad: 1,
      },
    },
  },
];

/** «Número 1 = ESTILO AUTOCRATICO» … «Número 4 = ESTILO SEPARADO», con el cuadro de percepción. */
export const CEAL_ESTILOS: Record<NumeroEstiloCeal, EstiloCeal> = {
  '1': {
    numero: 1,
    nombre: 'Autocrático',
    ineficaz: {
      nombre: 'AUTORITARIO',
      descripcion:
        'Visto a menudo como alguien que no confía en los demás, es desagradable y se interesa sólo en la producción a corto plazo.',
    },
    eficaz: {
      nombre: 'AUTOCRATA BENEVOLO',
      descripcion:
        'Visto a menudo como alguien que sabe lo que desea y que impone sus métodos para lograrlo sin provocar resentimiento.',
    },
  },
  '2': {
    numero: 2,
    nombre: 'Integrado',
    ineficaz: {
      nombre: 'COMPONEDOR',
      descripcion:
        'Visto a menudo como alguien que trata de agradar a todos y, por lo tanto, vacila de un lado a otro para evitar tensiones en una situación',
    },
    eficaz: {
      nombre: 'EJECUTIVO',
      descripcion:
        'Visto a menudo como alguien que es un buen motivador, maneja normas elevadas, trata a cada uno de modo diferente prefiere administrar en equipo.',
    },
  },
  '3': {
    numero: 3,
    nombre: 'Relacionado',
    ineficaz: {
      nombre: 'MISIONERO',
      descripcion:
        'Visto a menudo como alguien que está primordialmente interesado en la armonía y en ser considerado “buena gente” reticente a arriesgar la ruptura de una relación con tal de cumplir una tarea.',
    },
    eficaz: {
      nombre: 'PROMOTOR',
      descripcion:
        'Visto a menudo como alguien que tiene una confianza - implícita en las personas y que se interesa primordialmente en desarrollar sus aptitudes.',
    },
  },
  '4': {
    numero: 4,
    nombre: 'Separado',
    ineficaz: {
      nombre: 'DESERTOR',
      descripcion:
        'Visto a menudo como alguien que no se siente comprometido y es pasivo, y se preocupa poco por la tarea o por las personas que participan en ella',
    },
    eficaz: {
      nombre: 'BUROCRATA (+)',
      descripcion:
        'Visto a menudo como alguien que permite a sus subordinados decidir convenientemente cómo debe hacerse el trabajo y desempeña un papel menor en su interacción social.',
    },
  },
};

/** Tabla de efectividades de la pauta de corrección. */
export const CEAL_NIVELES_EFECTIVIDAD: {
  nombre: string;
  min: number;
  max: number;
}[] = [
  {
    nombre: 'MUY BAJA',
    min: -24,
    max: -13,
  },
  {
    nombre: 'BAJA',
    min: -12,
    max: -8,
  },
  {
    nombre: 'PROMEDIO BAJO',
    min: -7,
    max: -4,
  },
  {
    nombre: 'PROMEDIO MENOS',
    min: -3,
    max: -2,
  },
  {
    nombre: 'PROMEDIO',
    min: -1,
    max: 1,
  },
  {
    nombre: 'PROMEDIO MAS',
    min: 2,
    max: 3,
  },
  {
    nombre: 'PROMEDIO ALTO',
    min: 4,
    max: 7,
  },
  {
    nombre: 'ALTA',
    min: 8,
    max: 12,
  },
  {
    nombre: 'MUY ALTA',
    min: 13,
    max: 24,
  },
];

export const CEAL_PAUTA = {
  mide: 'Estilos de liderazgo, efectividad de cada estilo y efectividad total.',
  aplicacion:
    'Se aplica para aquellos cargos que tiene que cumplir con funciones de supervisión.',
  puntajes:
    'Esta prueba entrega datos respecto al uso de diferentes estilos de liderazgo, en términos de predominio y en términos de efectividad con que se utiliza cada estilo. Mayores detalles se entregan en la parte corrección de la prueba.',
  referenciaTeorica:
    'Como dato importante se puede decir que lo teórico es que hayan 3 respuestas por estilo y cada respuesta debe puntuar +2',
  formula: 'EFECTIVIDAD SITUACIONAL / ESTILO SITUACIONALES X 12',
};
