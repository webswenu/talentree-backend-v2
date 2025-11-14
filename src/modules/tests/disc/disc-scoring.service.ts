import { Injectable } from '@nestjs/common';
import { ITestScoring, ITestSubmission } from '../shared/interfaces';
import {
  DISC_DIMENSIONS,
  determineDiscProfile,
} from './constants/disc-dimensions.constant';

interface DiscAnswer {
  mas: string;
  menos: string;
}

@Injectable()
export class DiscScoringService {
  private calculateRawScores(
    answers: ITestSubmission['answers'],
  ): Record<string, number> {
    const rawScores: Record<string, number> = {
      D: 0,
      I: 0,
      S: 0,
      C: 0,
    };

    answers.forEach((answer) => {
      const discAnswer = answer.answer as DiscAnswer;

      if (discAnswer.mas) {
        rawScores[discAnswer.mas] += 1;
      }

      if (discAnswer.menos) {
        rawScores[discAnswer.menos] -= 1;
      }
    });

    return rawScores;
  }

  async scoreTest(submission: ITestSubmission): Promise<ITestScoring> {
    const rawScores = this.calculateRawScores(submission.answers);

    const totalResponses = submission.answers.length * 2;
    const scaledScores: Record<string, number> = {};

    Object.keys(rawScores).forEach((dimension) => {
      const normalized =
        ((rawScores[dimension] + submission.answers.length) / totalResponses) *
        100;
      scaledScores[dimension] = Math.round(normalized);
    });

    const profile = determineDiscProfile(rawScores);

    const descriptions: Record<string, string> = {};
    DISC_DIMENSIONS.forEach((dim) => {
      const score = rawScores[dim.code];
      const isHigh = score > 0;
      const traits = isHigh ? dim.highTraits : dim.lowTraits;
      descriptions[dim.code] = `${dim.name}: ${traits.slice(0, 3).join(', ')}`;
    });

    const completionTime =
      submission.completedAt.getTime() - submission.startedAt.getTime();

    return {
      rawScores,
      scaledScores,
      interpretation: {
        overallScore: undefined,
        categories: {
          profile,
          dominantDimension: Object.entries(rawScores).sort(
            ([, a], [, b]) => b - a,
          )[0][0],
        },
        descriptions,
        recommendations: this.getRecommendations(profile),
        metadata: {
          dimensionCount: DISC_DIMENSIONS.length,
          questionCount: submission.answers.length,
        },
      },
      completionTime,
    };
  }

  private getRecommendations(profile: string): string[] {
    const recommendations: Record<string, string[]> = {
      'D - Dominante': [
        'Aproveche su capacidad de tomar decisiones rápidas',
        'Trabaje en ser más paciente con otros',
        'Considere el impacto de sus decisiones en el equipo',
      ],
      'I - Influyente': [
        'Use su carisma para motivar al equipo',
        'Enfóquese en seguir tareas hasta completarlas',
        'Practique la escucha activa',
      ],
      'S - Estable': [
        'Su lealtad y paciencia son muy valoradas',
        'No tema expresar sus opiniones',
        'Adáptese gradualmente a los cambios',
      ],
      'C - Cumplidor': [
        'Su atención al detalle es un gran activo',
        'Confíe más en su intuición ocasionalmente',
        'Sea flexible cuando las circunstancias lo requieran',
      ],
    };

    return (
      recommendations[profile] || [
        'Mantenga el balance entre todas las dimensiones',
        'Desarrolle habilidades en áreas menos dominantes',
      ]
    );
  }
}
