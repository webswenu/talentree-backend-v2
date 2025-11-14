import { Injectable } from '@nestjs/common';
import { ITestScoring, ITestSubmission } from '../shared/interfaces';
import {
  getCfrInterpretation,
  getCfrRiskLevel,
  CFR_THRESHOLDS,
} from './constants/cfr-scoring.constant';

@Injectable()
export class CfrScoringService {
  async scoreTest(submission: ITestSubmission): Promise<ITestScoring> {
    let totalScore = 0;
    const maxPossibleScore = submission.answers.length * 5;
    const minPossibleScore = submission.answers.length * 1;

    submission.answers.forEach((answer) => {
      const likertValue = parseInt(answer.answer, 10);
      if (likertValue >= 1 && likertValue <= 5) {
        totalScore += likertValue;
      }
    });

    const rawScores = {
      total: totalScore,
      questionCount: submission.answers.length,
      average: totalScore / submission.answers.length,
    };

    const percentage =
      ((totalScore - minPossibleScore) /
        (maxPossibleScore - minPossibleScore)) *
      100;
    const scaledScores = {
      score: totalScore,
      percentage: Math.round(percentage * 10) / 10,
      maxPossible: maxPossibleScore,
      minPossible: minPossibleScore,
    };

    const interpretation = getCfrInterpretation(totalScore);
    const level = getCfrRiskLevel(totalScore);

    const completionTime =
      submission.completedAt.getTime() - submission.startedAt.getTime();

    return {
      rawScores,
      scaledScores,
      interpretation: {
        overallScore: totalScore,
        categories: {
          riskLevel: level,
        },
        descriptions: {
          level: interpretation.description,
          characteristics: interpretation.characteristics.join('; '),
        },
        recommendations: interpretation.recommendations,
        metadata: {
          thresholds: CFR_THRESHOLDS,
          averageResponse: rawScores.average,
        },
      },
      completionTime,
    };
  }
}
