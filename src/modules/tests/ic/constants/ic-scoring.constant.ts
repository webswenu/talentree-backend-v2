export enum IcLevel {
  BAJO = 'Bajo',
  MEDIO = 'Medio',
  ALTO = 'Alto',
}

export interface IcInterpretation {
  level: IcLevel;
  description: string;
  characteristics: string[];
  recommendations: string[];
}

export const IC_RANGES: Record<IcLevel, { min: number; max: number }> = {
  [IcLevel.BAJO]: { min: 0, max: 50 },
  [IcLevel.MEDIO]: { min: 51, max: 75 },
  [IcLevel.ALTO]: { min: 76, max: 100 },
};

export const IC_INTERPRETATIONS: Record<IcLevel, IcInterpretation> = {
  [IcLevel.BAJO]: {
    level: IcLevel.BAJO,
    description: 'Dificultad para seguir instrucciones complejas',
    characteristics: [
      'Puede tener problemas con tareas multi-paso',
      'Prefiere instrucciones simples y directas',
      'Requiere supervisión más cercana',
      'Puede cometer errores en tareas detalladas',
      'Beneficia de repetición y refuerzo',
    ],
    recommendations: [
      'Proporcione instrucciones claras y paso a paso',
      'Divida tareas complejas en pasos más simples',
      'Ofrezca capacitación adicional',
      'Supervise el trabajo inicialmente',
      'Use ayudas visuales cuando sea posible',
    ],
  },
  [IcLevel.MEDIO]: {
    level: IcLevel.MEDIO,
    description: 'Capacidad adecuada para seguir instrucciones complejas',
    characteristics: [
      'Puede seguir instrucciones de complejidad moderada',
      'Ocasionalmente puede requerir aclaraciones',
      'Se desempeña bien con supervisión normal',
      'Capaz de manejar la mayoría de tareas',
      'Aprende con la práctica',
    ],
    recommendations: [
      'Adecuado para roles con instrucciones estándar',
      'Proporcione documentación de referencia',
      'Ofrezca feedback regular',
      'Considere para roles operativos',
      'Apoye con ejemplos prácticos',
    ],
  },
  [IcLevel.ALTO]: {
    level: IcLevel.ALTO,
    description: 'Excelente capacidad para seguir instrucciones complejas',
    characteristics: [
      'Comprende rápidamente instrucciones detalladas',
      'Puede manejar múltiples tareas simultáneas',
      'Alta atención al detalle',
      'Requiere mínima supervisión',
      'Capaz de trabajar de forma independiente',
    ],
    recommendations: [
      'Ideal para roles que requieren precisión',
      'Puede asumir tareas técnicas complejas',
      'Candidato para entrenador de otros',
      'Adecuado para roles de control de calidad',
      'Puede manejar procedimientos elaborados',
    ],
  },
};

export function getIcLevel(percentage: number): IcLevel {
  if (percentage <= IC_RANGES[IcLevel.BAJO].max) {
    return IcLevel.BAJO;
  }
  if (percentage <= IC_RANGES[IcLevel.MEDIO].max) {
    return IcLevel.MEDIO;
  }
  return IcLevel.ALTO;
}

export function getIcInterpretation(percentage: number): IcInterpretation {
  const level = getIcLevel(percentage);
  return IC_INTERPRETATIONS[level];
}
