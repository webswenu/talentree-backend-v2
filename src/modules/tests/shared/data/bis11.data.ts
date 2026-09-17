/**
 * Escala de Impulsividad de Barratt (BIS-11).
 *
 * Fuente: `Barrett_Escala_de_Impulsividad_TABULADO.xlsx` (hojas Instrucciones,
 * Cuestionario, Tabulación, Resultados e Informe). Este archivo lo generó un
 * script a partir del Excel, y el script comprobó que las fórmulas son las que
 * implementa el puntuador. Los textos se corrigieron solo de ortografía
 * (17-09-2026); el contenido sigue siendo el del Excel.
 *
 * Es la versión chilena publicada (Salvo y Castro, 2013): escala 0-1-3-4,
 * 12 ítems inversos, subescalas de 8, 10 y 12 ítems.
 */

export type DimensionBis11 = 'ATENCIONAL' | 'MOTORA' | 'NO_PLANIFICACION';
export type NivelBis11 = 'Bajo' | 'Moderado' | 'Alto';

export interface ItemBis11 {
  numero: number;
  texto: string;
  dimension: DimensionBis11;
  /** Columna «Inverso» del cuestionario: el puntaje corregido es 4 - respuesta. */
  inverso: boolean;
}

export const BIS11_INSTRUCCIONES =
  'Esta es una escala para medir algunas de las formas en que usted actúa y piensa. No se detenga demasiado tiempo en las oraciones. Responda rápida y honestamente marcando una X en la opción que más le represente';

/** Encabezados del cuestionario: «Raramente o nunca (0)» … «Siempre o casi siempre (4)». */
export const BIS11_OPCIONES: {
  clave: 'A' | 'B' | 'C' | 'D';
  texto: string;
  valor: number;
}[] = [
  {
    clave: 'A',
    texto: 'Raramente o nunca',
    valor: 0,
  },
  {
    clave: 'B',
    texto: 'Ocasionalmente',
    valor: 1,
  },
  {
    clave: 'C',
    texto: 'A menudo',
    valor: 3,
  },
  {
    clave: 'D',
    texto: 'Siempre o casi siempre',
    valor: 4,
  },
];

export const BIS11_DIMENSIONES: Record<
  DimensionBis11,
  { nombre: string; factor: string }
> = {
  ATENCIONAL: {
    nombre: 'Atencional',
    factor: 'ATENCIONAL',
  },
  MOTORA: {
    nombre: 'Motora',
    factor: 'MOTORA',
  },
  NO_PLANIFICACION: {
    nombre: 'No planificación',
    factor: 'NO_PLAN',
  },
};

export const BIS11_ITEMS: ItemBis11[] = [
  {
    numero: 1,
    texto: 'Planifico mis tareas con cuidado',
    dimension: 'NO_PLANIFICACION',
    inverso: true,
  },
  {
    numero: 2,
    texto: 'Hago las cosas sin pensarlas',
    dimension: 'MOTORA',
    inverso: false,
  },
  {
    numero: 3,
    texto: 'Casi nunca me tomo las cosas a pecho (no me perturbo fácilmente)',
    dimension: 'NO_PLANIFICACION',
    inverso: false,
  },
  {
    numero: 4,
    texto:
      'Mis pensamientos pueden tener gran velocidad (mis pensamientos van muy rápido en mi mente)',
    dimension: 'ATENCIONAL',
    inverso: false,
  },
  {
    numero: 5,
    texto: 'Planifico mis viajes (actividades) con antelación',
    dimension: 'NO_PLANIFICACION',
    inverso: true,
  },
  {
    numero: 6,
    texto: 'Soy una persona con autocontrol',
    dimension: 'MOTORA',
    inverso: true,
  },
  {
    numero: 7,
    texto: 'Me concentro con facilidad',
    dimension: 'ATENCIONAL',
    inverso: true,
  },
  {
    numero: 8,
    texto: 'Ahorro con regularidad',
    dimension: 'NO_PLANIFICACION',
    inverso: true,
  },
  {
    numero: 9,
    texto: 'Se me hace difícil estar quieto/a por largos periodos de tiempo',
    dimension: 'MOTORA',
    inverso: false,
  },
  {
    numero: 10,
    texto: 'Pienso las cosas cuidadosamente',
    dimension: 'ATENCIONAL',
    inverso: true,
  },
  {
    numero: 11,
    texto:
      'Planifico para tener un trabajo fijo (me esfuerzo para asegurarme que tendré dinero para mis gastos)',
    dimension: 'NO_PLANIFICACION',
    inverso: true,
  },
  {
    numero: 12,
    texto: 'Digo las cosas sin pensarlas',
    dimension: 'MOTORA',
    inverso: false,
  },
  {
    numero: 13,
    texto:
      'Me gusta pensar sobre problemas complicados (me gusta pensar sobre problemas complejos)',
    dimension: 'ATENCIONAL',
    inverso: true,
  },
  {
    numero: 14,
    texto: 'Cambio de trabajo frecuentemente',
    dimension: 'NO_PLANIFICACION',
    inverso: false,
  },
  {
    numero: 15,
    texto: 'Actúo impulsivamente',
    dimension: 'MOTORA',
    inverso: false,
  },
  {
    numero: 16,
    texto: 'Me aburre pensar en algo por demasiado tiempo',
    dimension: 'ATENCIONAL',
    inverso: false,
  },
  {
    numero: 17,
    texto: 'Visito al médico y al dentista con regularidad',
    dimension: 'NO_PLANIFICACION',
    inverso: true,
  },
  {
    numero: 18,
    texto: 'Hago las cosas en el momento en que se me ocurren',
    dimension: 'MOTORA',
    inverso: false,
  },
  {
    numero: 19,
    texto:
      'Soy una persona que piensa sin distraerse (puedo enfocar mi mente en una sola cosa por mucho tiempo)',
    dimension: 'ATENCIONAL',
    inverso: true,
  },
  {
    numero: 20,
    texto: 'Cambio de vivienda a menudo',
    dimension: 'NO_PLANIFICACION',
    inverso: false,
  },
  {
    numero: 21,
    texto: 'Compro cosas impulsivamente',
    dimension: 'MOTORA',
    inverso: false,
  },
  {
    numero: 22,
    texto: 'Yo termino lo que empiezo',
    dimension: 'NO_PLANIFICACION',
    inverso: true,
  },
  {
    numero: 23,
    texto: 'Camino y me muevo con rapidez',
    dimension: 'MOTORA',
    inverso: false,
  },
  {
    numero: 24,
    texto:
      'Resuelvo los problemas experimentando (resuelvo los problemas tratando una posible solución y viendo si funciona)',
    dimension: 'ATENCIONAL',
    inverso: false,
  },
  {
    numero: 25,
    texto: 'Gasto más dinero de lo que tengo o de lo que gano',
    dimension: 'NO_PLANIFICACION',
    inverso: false,
  },
  {
    numero: 26,
    texto: 'Hablo rápido',
    dimension: 'MOTORA',
    inverso: false,
  },
  {
    numero: 27,
    texto: 'Tengo pensamientos extraños (irrelevantes) cuando estoy pensando',
    dimension: 'ATENCIONAL',
    inverso: false,
  },
  {
    numero: 28,
    texto: 'Me interesa más el presente que el futuro',
    dimension: 'NO_PLANIFICACION',
    inverso: false,
  },
  {
    numero: 29,
    texto:
      'Me siento inquieto/a si tengo que oír a alguien hablar demasiado tiempo',
    dimension: 'MOTORA',
    inverso: false,
  },
  {
    numero: 30,
    texto:
      'Planifico para el futuro (me interesa más el futuro que el presente)',
    dimension: 'NO_PLANIFICACION',
    inverso: true,
  },
];

/**
 * Referencia poblacional con la que el Excel clasifica el TOTAL:
 * Bajo si < media - DT, Moderado si <= media + DT, Alto si es mayor.
 */
export const BIS11_REFERENCIA_TOTAL = { media: 63.88, dt: 11.32 };

/** Hoja «Resultados»: los 12 textos por dimensión y nivel, más el TOTAL. */
export const BIS11_INTERPRETACIONES: Record<
  DimensionBis11 | 'TOTAL',
  Record<NivelBis11, string>
> = {
  ATENCIONAL: {
    Bajo: 'Quien obtiene un puntaje bajo en impulsividad atencional muestra, en general, una buena capacidad para sostener la concentración durante períodos prolongados, incluso en tareas rutinarias o poco estimulantes. Es habitual que pueda seguir instrucciones complejas, mantener el hilo de una conversación extensa y trabajar con bajos niveles de distracción frente a estímulos del entorno. En el plano laboral, este patrón suele asociarse a un buen desempeño en tareas que requieren atención sostenida, control de calidad o revisión de procesos que no toleran errores por descuido. No se identifican indicadores de riesgo relevantes en esta dimensión.',
    Moderado:
      'Un puntaje moderado en impulsividad atencional indica un nivel de concentración dentro de lo esperable para la población general: la persona puede mantener el foco en la mayoría de las tareas cotidianas, aunque es posible que presente distracciones ocasionales frente a tareas largas, monótonas o en ambientes con múltiples estímulos. En el plano laboral, este perfil no suele representar una limitación significativa, aunque podría beneficiarse de pausas breves en tareas de atención sostenida muy prolongada (más de 45 a 60 minutos continuos).',
    Alto: 'Un puntaje alto en impulsividad atencional sugiere dificultades frecuentes para sostener la atención: la persona reporta distraerse con facilidad, saltar de una idea a otra, perder el hilo de lo que está haciendo y necesitar recordarse a sí misma volver a enfocarse. En el plano laboral, este patrón puede traducirse en mayor probabilidad de errores por falta de atención en tareas extensas o repetitivas, y dificultad en procesos que exigen concentración sostenida. Suele beneficiarse de tareas fragmentadas en bloques cortos con pausas frecuentes. Se recomienda profundizar en entrevista sobre estrategias de organización personal y, si el cargo exige alta concentración sostenida (por ejemplo, control de procesos críticos, conducción o manejo de maquinaria), evaluar esta dimensión con mayor detalle.',
  },
  MOTORA: {
    Bajo: 'Un puntaje bajo en impulsividad motora refleja una tendencia a pensar antes de actuar y a mantener control sobre las respuestas inmediatas. Las decisiones suelen ser reflexivas incluso en situaciones de presión o urgencia, y la persona tiende a evaluar alternativas antes de responder o actuar. En el plano laboral, este perfil favorece roles que requieren cautela, apego a protocolos y toma de decisiones ponderada, como los relacionados con seguridad, calidad o cumplimiento normativo.',
    Moderado:
      'Un puntaje moderado en impulsividad motora indica un equilibrio entre espontaneidad y reflexión: la persona puede actuar con rapidez en algunas situaciones y detenerse a pensar en otras, sin un patrón marcado hacia ninguno de los dos extremos. Este perfil suele ser compatible con la mayoría de los puestos de trabajo, adaptándose tanto a tareas que requieren rapidez de respuesta como a las que exigen mayor ponderación.',
    Alto: 'Un puntaje alto en impulsividad motora sugiere una tendencia a actuar, hablar y responder con rapidez, muchas veces sin detenerse a evaluar las consecuencias. Puede manifestarse como interrupciones frecuentes en conversaciones, cambios de actividad sin planificación previa, o reacciones inmediatas ante situaciones que generan molestia. En el plano laboral, este patrón puede representar un factor de riesgo en cargos que exigen apego estricto a protocolos de seguridad, manejo de maquinaria, conducción de vehículos o toma de decisiones bajo presión sin supervisión inmediata. Se recomienda profundizar en entrevista y, de ser pertinente para el cargo, complementar con pruebas de atención al riesgo y autocontrol.',
  },
  NO_PLANIFICACION: {
    Bajo: 'Un puntaje bajo en la dimensión de no planificación indica una clara orientación hacia el largo plazo: la persona organiza sus actividades con anticipación, planifica sus finanzas y evalúa las consecuencias futuras antes de tomar decisiones importantes. En el plano laboral, este perfil favorece roles que requieren planificación estratégica, gestión de proyectos a mediano y largo plazo, y responsabilidad sobre recursos o presupuestos.',
    Moderado:
      'Un puntaje moderado en no planificación indica que la persona combina momentos de planificación con decisiones más espontáneas, sin una tendencia marcada hacia la improvisación ni hacia la organización estricta. Este perfil es compatible con la mayoría de los contextos laborales, mostrando flexibilidad tanto para seguir procesos establecidos como para adaptarse a cambios de último momento.',
    Alto: 'Un puntaje alto en no planificación sugiere una marcada orientación al presente, con dificultades para proyectarse a futuro, planificar tareas a mediano o largo plazo, o postergar la gratificación inmediata en favor de objetivos futuros. Puede expresarse como cambios frecuentes de planes, dificultad para seguir rutinas u horarios fijos, y decisiones financieras poco previsoras. En el plano laboral, este patrón puede representar un desafío en cargos que requieren planificación a largo plazo, gestión de proyectos extensos o responsabilidad sobre presupuestos. Se recomienda reforzar con herramientas externas de organización (listas de tareas, recordatorios, checklists) y profundizar en entrevista sobre su historial de cumplimiento de plazos y compromisos.',
  },
  TOTAL: {
    Bajo: 'El puntaje total obtenido se ubica por debajo de 52.6 puntos, bajo la referencia poblacional (media 63.88, desviación típica 11.32; adaptación española del BIS-11, muestra general n=703). En conjunto, el patrón de respuestas sugiere un buen nivel de autocontrol y reflexión antes de actuar, tanto en el plano atencional como en el motor y en la planificación a futuro. No se identifican indicadores de impulsividad clínicamente relevantes a partir de este instrumento. Se sugiere de todas formas contrastar este resultado con la información recabada en entrevista y, si el proceso lo amerita, con otras pruebas de la batería de evaluación.',
    Moderado:
      'El puntaje total obtenido se ubica dentro del rango esperado para la población general (entre 52.6 y 75.2 puntos, considerando una media de 63.88 y una desviación típica de 11.32 en la adaptación española del BIS-11, n=703). El patrón de respuestas no muestra un predominio marcado de la impulsividad ni de un autocontrol estricto en ninguna de las tres dimensiones evaluadas. Es un resultado compatible con la mayoría de los perfiles laborales, sin alertas particulares que profundizar solo a partir de este instrumento.',
    Alto: 'El puntaje total obtenido se ubica por sobre 75.2 puntos, sobre la referencia poblacional (media 63.88, desviación típica 11.32; adaptación española del BIS-11, muestra general n=703). En conjunto, el patrón de respuestas sugiere una tendencia marcada a actuar sin planificación ni reflexión previa, de forma consistente en más de una dimensión (atención, acción y/o planificación a futuro). Se recomienda profundizar con entrevista estructurada, contrastar con los demás instrumentos de la batería aplicada, y — de ser pertinente para el cargo y con el resguardo profesional correspondiente — derivar a una evaluación clínica complementaria antes de tomar decisiones basadas únicamente en este resultado.',
  },
};

export const BIS11_NOTA_TABULACION =
  'Puntaje corregido = aplica puntuación inversa a los ítems 1, 5, 6, 7, 8, 10, 11, 13, 17, 19, 22 y 30 (escala 0-1-3-4). El nivel del TOTAL se calcula contra una referencia poblacional publicada (media=63.88, DT=11.32; adaptación española BIS-11, n=703). El nivel de cada subescala es una estimación aproximada por tercios de su puntaje posible, sin normas poblacionales equivalentes.';

export const BIS11_NOTA_CATALOGO =
  'Catálogo de referencia con los 12 resultados posibles (3 dimensiones + total, cada uno en nivel Bajo / Moderado / Alto) y su lectura interpretativa. Uso orientativo, no diagnóstico.';

export const BIS11_NOTA_METODOLOGICA =
  'Este informe se generó a partir de la Escala de Impulsividad de Barratt (BIS-11), aplicando la estructura oficial de corrección: 8 ítems de impulsividad atencional, 10 de impulsividad motora y 12 de no planificación, con inversión de puntaje en los ítems correspondientes. El nivel del puntaje total se contrasta con una referencia poblacional publicada (media=63.88, DT=11.32; adaptación española del BIS-11, muestra general n=703); las subescalas se presentan con un nivel aproximado, dado que no se cuenta con normas poblacionales igual de difundidas para ellas. Este informe es una herramienta de apoyo a la toma de decisiones y no constituye, por sí sola, un diagnóstico clínico. Se recomienda que su interpretación final y la decisión asociada al proceso de selección sean validadas por un profesional competente, en conjunto con el resto de la batería de evaluación y la información recogida en entrevista.';
