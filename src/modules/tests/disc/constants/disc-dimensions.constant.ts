export interface DiscDimension {
  code: string;
  name: string;
  description: string;
  highTraits: string[];
  lowTraits: string[];
}

export const DISC_DIMENSIONS: DiscDimension[] = [
  {
    code: 'D',
    name: 'Dominancia',
    description: 'Mide cómo la persona responde a problemas y desafíos',
    highTraits: [
      'Directo',
      'Decidido',
      'Competitivo',
      'Exigente',
      'Orientado a resultados',
      'Asume riesgos',
    ],
    lowTraits: [
      'Cooperativo',
      'Calculador',
      'Prudente',
      'Modesto',
      'Pacífico',
      'Discreto',
    ],
  },
  {
    code: 'I',
    name: 'Influencia',
    description: 'Mide cómo la persona se relaciona e influye en otros',
    highTraits: [
      'Sociable',
      'Optimista',
      'Entusiasta',
      'Persuasivo',
      'Expresivo',
      'Confiado',
    ],
    lowTraits: [
      'Reflexivo',
      'Objetivo',
      'Reservado',
      'Pesimista',
      'Controlado',
      'Escéptico',
    ],
  },
  {
    code: 'S',
    name: 'Estabilidad',
    description: 'Mide cómo la persona responde al ritmo y cambios del entorno',
    highTraits: [
      'Paciente',
      'Leal',
      'Predecible',
      'Constante',
      'Estable',
      'Buen oyente',
    ],
    lowTraits: [
      'Impaciente',
      'Inquieto',
      'Impulsivo',
      'Versátil',
      'Activo',
      'Variable',
    ],
  },
  {
    code: 'C',
    name: 'Cumplimiento',
    description: 'Mide cómo la persona responde a reglas y procedimientos',
    highTraits: [
      'Preciso',
      'Analítico',
      'Diplomático',
      'Sistemático',
      'Cauteloso',
      'Detallista',
    ],
    lowTraits: [
      'Independiente',
      'Obstinado',
      'Directo',
      'Despreocupado',
      'Firme',
      'Testarudo',
    ],
  },
];

export function getDiscDimension(code: string): DiscDimension | undefined {
  return DISC_DIMENSIONS.find((d) => d.code === code);
}

export enum DiscProfile {
  DOMINANTE = 'D - Dominante',
  INFLUYENTE = 'I - Influyente',
  ESTABLE = 'S - Estable',
  CUMPLIDOR = 'C - Cumplidor',
  DI = 'DI - Dominante Influyente',
  DC = 'DC - Dominante Cumplidor',
  IS = 'IS - Influyente Estable',
  SC = 'SC - Estable Cumplidor',
  BALANCEADO = 'Balanceado',
}

export function determineDiscProfile(
  scores: Record<string, number>,
): DiscProfile {
  const sortedDimensions = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .map(([code]) => code);

  const highest = sortedDimensions[0];
  const secondHighest = sortedDimensions[1];

  const highestScore = scores[highest];
  const secondScore = scores[secondHighest];

  const scoreDiff = highestScore - secondScore;

  if (scoreDiff <= 3) {
    const combined = highest + secondHighest;
    switch (combined) {
      case 'DI':
      case 'ID':
        return DiscProfile.DI;
      case 'DC':
      case 'CD':
        return DiscProfile.DC;
      case 'IS':
      case 'SI':
        return DiscProfile.IS;
      case 'SC':
      case 'CS':
        return DiscProfile.SC;
      default:
        return DiscProfile.BALANCEADO;
    }
  }

  switch (highest) {
    case 'D':
      return DiscProfile.DOMINANTE;
    case 'I':
      return DiscProfile.INFLUYENTE;
    case 'S':
      return DiscProfile.ESTABLE;
    case 'C':
      return DiscProfile.CUMPLIDOR;
    default:
      return DiscProfile.BALANCEADO;
  }
}
