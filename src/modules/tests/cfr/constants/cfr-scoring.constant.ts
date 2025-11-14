export enum CfrRiskLevel {
  BAJO = 'Bajo',
  MEDIO = 'Medio',
  ALTO = 'Alto',
}

export interface CfrInterpretation {
  level: CfrRiskLevel;
  description: string;
  characteristics: string[];
  recommendations: string[];
}

export const CFR_THRESHOLDS = {
  [CfrRiskLevel.BAJO]: { min: 0, max: 120 },
  [CfrRiskLevel.MEDIO]: { min: 121, max: 200 },
  [CfrRiskLevel.ALTO]: { min: 201, max: 300 },
};

export const CFR_INTERPRETATIONS: Record<CfrRiskLevel, CfrInterpretation> = {
  [CfrRiskLevel.BAJO]: {
    level: CfrRiskLevel.BAJO,
    description: 'Nivel bajo de conducta de riesgo',
    characteristics: [
      'Prefiere entornos seguros y predecibles',
      'Evita tomar riesgos innecesarios',
      'Sigue procedimientos establecidos',
      'Prioriza la seguridad sobre la velocidad',
      'Pensamiento cauteloso antes de actuar',
    ],
    recommendations: [
      'Ideal para roles que requieren alta atención a seguridad',
      'Excelente para posiciones con protocolos estrictos',
      'Adecuado para ambientes regulados',
      'Puede requerir apoyo en situaciones de cambio rápido',
    ],
  },
  [CfrRiskLevel.MEDIO]: {
    level: CfrRiskLevel.MEDIO,
    description: 'Nivel moderado de conducta de riesgo',
    characteristics: [
      'Balance entre precaución y toma de riesgos',
      'Evalúa riesgos antes de actuar',
      'Flexible según el contexto',
      'Puede adaptarse a diferentes situaciones',
      'Considera tanto seguridad como eficiencia',
    ],
    recommendations: [
      'Apto para roles con nivel moderado de riesgo',
      'Buen balance para la mayoría de posiciones',
      'Puede supervisar y ejecutar tareas variadas',
      'Capacidad de adaptación a diferentes contextos',
    ],
  },
  [CfrRiskLevel.ALTO]: {
    level: CfrRiskLevel.ALTO,
    description: 'Nivel alto de conducta de riesgo',
    characteristics: [
      'Dispuesto a tomar riesgos calculados',
      'Actúa rápidamente en situaciones inciertas',
      'Busca soluciones innovadoras',
      'Cómodo con ambigüedad e incertidumbre',
      'Puede priorizar velocidad sobre precaución',
    ],
    recommendations: [
      'Requiere supervisión en ambientes de alto riesgo',
      'Necesita capacitación reforzada en seguridad',
      'Puede beneficiar de protocolos estrictos',
      'Ideal para roles creativos o de innovación bajo supervisión',
    ],
  },
};

export function getCfrRiskLevel(totalScore: number): CfrRiskLevel {
  if (totalScore <= CFR_THRESHOLDS[CfrRiskLevel.BAJO].max) {
    return CfrRiskLevel.BAJO;
  }
  if (totalScore <= CFR_THRESHOLDS[CfrRiskLevel.MEDIO].max) {
    return CfrRiskLevel.MEDIO;
  }
  return CfrRiskLevel.ALTO;
}

export function getCfrInterpretation(totalScore: number): CfrInterpretation {
  const level = getCfrRiskLevel(totalScore);
  return CFR_INTERPRETATIONS[level];
}
