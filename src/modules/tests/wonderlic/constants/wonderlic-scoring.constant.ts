export enum WonderlicLevel {
  BAJO = 'Bajo',
  MEDIO = 'Medio',
  ALTO = 'Alto',
}

export interface WonderlicInterpretation {
  level: WonderlicLevel;
  description: string;
  characteristics: string[];
}

export const WONDERLIC_RANGES: Record<
  WonderlicLevel,
  { min: number; max: number }
> = {
  [WonderlicLevel.BAJO]: { min: 0, max: 7 },
  [WonderlicLevel.MEDIO]: { min: 8, max: 14 },
  [WonderlicLevel.ALTO]: { min: 15, max: 20 },
};

export const WONDERLIC_INTERPRETATIONS: Record<
  WonderlicLevel,
  WonderlicInterpretation
> = {
  [WonderlicLevel.BAJO]: {
    level: WonderlicLevel.BAJO,
    description: 'Nivel de inteligencia laboral por debajo del promedio',
    characteristics: [
      'Puede requerir más tiempo para procesar información compleja',
      'Se desempeña mejor en tareas rutinarias y estructuradas',
      'Beneficia de instrucciones claras y paso a paso',
      'Puede necesitar supervisión más cercana',
    ],
  },
  [WonderlicLevel.MEDIO]: {
    level: WonderlicLevel.MEDIO,
    description: 'Nivel de inteligencia laboral promedio',
    characteristics: [
      'Capacidad adecuada para resolver problemas cotidianos',
      'Puede manejar tareas de complejidad moderada',
      'Se adapta bien a roles con responsabilidades definidas',
      'Buen balance entre habilidades prácticas y conceptuales',
    ],
  },
  [WonderlicLevel.ALTO]: {
    level: WonderlicLevel.ALTO,
    description: 'Nivel de inteligencia laboral superior al promedio',
    characteristics: [
      'Excelente capacidad de análisis y resolución de problemas',
      'Aprende rápidamente nuevos conceptos y habilidades',
      'Se desempeña bien en roles de alta complejidad',
      'Puede sobresalir en posiciones de liderazgo y toma de decisiones',
    ],
  },
};

export function getWonderlicInterpretation(
  score: number,
): WonderlicInterpretation {
  if (score <= WONDERLIC_RANGES[WonderlicLevel.BAJO].max) {
    return WONDERLIC_INTERPRETATIONS[WonderlicLevel.BAJO];
  }
  if (score <= WONDERLIC_RANGES[WonderlicLevel.MEDIO].max) {
    return WONDERLIC_INTERPRETATIONS[WonderlicLevel.MEDIO];
  }
  return WONDERLIC_INTERPRETATIONS[WonderlicLevel.ALTO];
}

export function getWonderlicLevel(score: number): WonderlicLevel {
  if (score <= WONDERLIC_RANGES[WonderlicLevel.BAJO].max) {
    return WonderlicLevel.BAJO;
  }
  if (score <= WONDERLIC_RANGES[WonderlicLevel.MEDIO].max) {
    return WonderlicLevel.MEDIO;
  }
  return WonderlicLevel.ALTO;
}
