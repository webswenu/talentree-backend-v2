import { Injectable } from '@nestjs/common';
import { ITestScoring, ITestSubmission } from '../shared/interfaces';
import {
  FACTORS_16PF,
  getFactor,
  getDecatipoLevel,
} from './constants/16pf-factors.constant';

interface NormativeEntry {
  factor: string;
  mean: number;
  stdDev: number;
}

@Injectable()
export class SixteenPfScoringService {
  private calculateZScore(
    rawScore: number,
    mean: number,
    stdDev: number,
  ): number {
    if (stdDev === 0) {
      throw new Error('Standard deviation cannot be zero');
    }
    return (rawScore - mean) / stdDev;
  }

  private calculateDecatipo(zScore: number): number {
    const decatipo = zScore * 2 + 5.5;
    // Clamp to valid range
    return Math.max(1, Math.min(10, Math.round(decatipo * 10) / 10));
  }

  private calculateRawScores(
    answers: ITestSubmission['answers'],
    questions: any[],
  ): Record<string, number> {
    const rawScores: Record<string, number> = {};

    FACTORS_16PF.forEach((factor) => {
      rawScores[factor.code] = 0;
    });

    answers.forEach((answer) => {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) return;

      const factor = question.factor;
      const selectedOption = answer.answer;
      const polarity = question.metadata?.polarity || 1;
      const scoring = question.options?.scoring || { A: 0, B: 1, C: 2 };

      const optionScore = scoring[selectedOption] || 0;

      rawScores[factor] += optionScore * polarity;
    });

    return rawScores;
  }

  async scoreTest(
    submission: ITestSubmission,
    questions: any[],
    normativeTable: NormativeEntry[],
  ): Promise<ITestScoring> {
    const rawScores = this.calculateRawScores(submission.answers, questions);

    const scaledScores: Record<string, number> = {};
    const interpretations: Record<string, string> = {};
    const descriptions: Record<string, string> = {};

    for (const entry of normativeTable) {
      const rawScore = rawScores[entry.factor] || 0;

      const zScore = this.calculateZScore(rawScore, entry.mean, entry.stdDev);

      const decatipo = this.calculateDecatipo(zScore);
      scaledScores[entry.factor] = decatipo;

      const level = getDecatipoLevel(decatipo);
      interpretations[entry.factor] = level;

      const factor = getFactor(entry.factor);
      if (factor) {
        descriptions[entry.factor] =
          decatipo >= 6 ? factor.highDescription : factor.lowDescription;
      }
    }

    const completionTime =
      submission.completedAt.getTime() - submission.startedAt.getTime();

    return {
      rawScores,
      scaledScores,
      interpretation: {
        categories: interpretations,
        descriptions,
        metadata: {
          factorCount: FACTORS_16PF.length,
          normativeTableUsed: 'standard',
        },
      },
      completionTime,
    };
  }

  getFactorInterpretation(factor: string, decatipo: number): string {
    const factorDef = getFactor(factor);
    if (!factorDef) return 'Factor desconocido';

    const level = getDecatipoLevel(decatipo);
    const description =
      decatipo >= 6 ? factorDef.highDescription : factorDef.lowDescription;

    return `${factorDef.name}: ${description} (Decatipo: ${decatipo}, Nivel: ${level})`;
  }
}
