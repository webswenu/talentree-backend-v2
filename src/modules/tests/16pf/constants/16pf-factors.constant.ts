export interface Factor16PF {
  code: string;
  name: string;
  lowDescription: string;
  highDescription: string;
}

export const FACTORS_16PF: Factor16PF[] = [
  {
    code: 'A',
    name: 'Afectotimia',
    lowDescription: 'Reservado, frío, distante',
    highDescription: 'Cálido, afable, cercano',
  },
  {
    code: 'B',
    name: 'Inteligencia',
    lowDescription: 'Pensamiento concreto',
    highDescription: 'Pensamiento abstracto',
  },
  {
    code: 'C',
    name: 'Estabilidad Emocional',
    lowDescription: 'Emocionalmente inestable',
    highDescription: 'Emocionalmente estable',
  },
  {
    code: 'E',
    name: 'Dominancia',
    lowDescription: 'Sumiso, conformista',
    highDescription: 'Dominante, asertivo',
  },
  {
    code: 'F',
    name: 'Impulsividad',
    lowDescription: 'Serio, prudente',
    highDescription: 'Entusiasta, impulsivo',
  },
  {
    code: 'G',
    name: 'Conformidad Grupal',
    lowDescription: 'No conformista',
    highDescription: 'Conformista, normativo',
  },
  {
    code: 'H',
    name: 'Atrevimiento',
    lowDescription: 'Tímido, inhibido',
    highDescription: 'Atrevido, sociable',
  },
  {
    code: 'I',
    name: 'Sensibilidad',
    lowDescription: 'Realista, práctico',
    highDescription: 'Sensible, emocional',
  },
  {
    code: 'L',
    name: 'Suspicacia',
    lowDescription: 'Confiado, sin sospechas',
    highDescription: 'Suspicaz, desconfiado',
  },
  {
    code: 'M',
    name: 'Imaginación',
    lowDescription: 'Práctico, realista',
    highDescription: 'Imaginativo, idealista',
  },
  {
    code: 'N',
    name: 'Astucia',
    lowDescription: 'Natural, espontáneo',
    highDescription: 'Astuto, calculador',
  },
  {
    code: 'O',
    name: 'Culpabilidad',
    lowDescription: 'Seguro, confiado',
    highDescription: 'Inseguro, preocupado',
  },
  {
    code: 'Q1',
    name: 'Rebeldía',
    lowDescription: 'Conservador, tradicional',
    highDescription: 'Rebelde, innovador',
  },
  {
    code: 'Q2',
    name: 'Autosuficiencia',
    lowDescription: 'Dependiente del grupo',
    highDescription: 'Autosuficiente, individualista',
  },
  {
    code: 'Q3',
    name: 'Autocontrol',
    lowDescription: 'Sin control, descuidado',
    highDescription: 'Controlado, disciplinado',
  },
  {
    code: 'Q4',
    name: 'Tensión',
    lowDescription: 'Relajado, tranquilo',
    highDescription: 'Tenso, ansioso',
  },
];

/**
 * Get factor definition by code
 */
export function getFactor(code: string): Factor16PF | undefined {
  return FACTORS_16PF.find((f) => f.code === code);
}

/**
 * Decatipo interpretation ranges
 * Decatipo scores range from 1-10
 */
export enum DecatipoLevel {
  MUY_BAJO = 'Muy Bajo',
  BAJO = 'Bajo',
  PROMEDIO = 'Promedio',
  ALTO = 'Alto',
  MUY_ALTO = 'Muy Alto',
}

export function getDecatipoLevel(decatipo: number): DecatipoLevel {
  if (decatipo <= 3) return DecatipoLevel.MUY_BAJO;
  if (decatipo <= 4) return DecatipoLevel.BAJO;
  if (decatipo >= 8) return DecatipoLevel.MUY_ALTO;
  if (decatipo >= 7) return DecatipoLevel.ALTO;
  return DecatipoLevel.PROMEDIO;
}
