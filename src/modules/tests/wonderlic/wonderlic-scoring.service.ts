/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { ITestScoring, ITestSubmission } from '../shared/interfaces';
import {
  getWonderlicInterpretation,
  getWonderlicLevel,
} from './constants/wonderlic-scoring.constant';

@Injectable()
export class WonderlicScoringService {
  async scoreTest(
    submission: ITestSubmission,
    questions: any[],
  ): Promise<ITestScoring> {
    let correctAnswers = 0;
    const maxScore = questions.length;

    submission.answers.forEach((answer) => {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) return;

      const correctAnswer = question.correctAnswer;
      const userAnswer = answer.answer;

      if (this.isCorrectAnswer(userAnswer, correctAnswer)) {
        correctAnswers++;
      }
    });

    const rawScores = {
      correct: correctAnswers,
      incorrect: maxScore - correctAnswers,
      total: maxScore,
    };

    const percentage = (correctAnswers / maxScore) * 100;
    const scaledScores = {
      score: correctAnswers,
      percentage: Math.round(percentage * 10) / 10,
    };

    const interpretation = getWonderlicInterpretation(correctAnswers);
    const level = getWonderlicLevel(correctAnswers);

    const completionTime =
      submission.completedAt.getTime() - submission.startedAt.getTime();

    return {
      rawScores,
      scaledScores,
      interpretation: {
        overallScore: correctAnswers,
        categories: {
          level,
        },
        descriptions: {
          level: interpretation.description,
          characteristics: interpretation.characteristics.join('; '),
        },
        recommendations: this.getRecommendations(
          level,
          correctAnswers,
          maxScore,
        ),
        metadata: {
          maxScore,
          percentage,
        },
      },
      completionTime,
    };
  }

  private isCorrectAnswer(userAnswer: any, correctAnswer: any): boolean {
    if (typeof userAnswer === 'string' && typeof correctAnswer === 'string') {
      return userAnswer.toUpperCase() === correctAnswer.toUpperCase();
    }

    if (Array.isArray(userAnswer) && Array.isArray(correctAnswer)) {
      return (
        userAnswer.length === correctAnswer.length &&
        userAnswer.every((ans) => correctAnswer.includes(ans))
      );
    }

    return userAnswer === correctAnswer;
  }

  private getRecommendations(
    level: string,
    score: number,
    maxScore: number,
  ): string[] {
    const percentage = (score / maxScore) * 100;

    if (level === 'Bajo') {
      return [
        'Considere programas de capacitación y desarrollo',
        'Asigne tareas con instrucciones claras y estructuradas',
        'Proporcione retroalimentación frecuente',
        'Establezca metas alcanzables a corto plazo',
      ];
    }

    if (level === 'Medio') {
      return [
        'Continúe desarrollando habilidades específicas',
        'Aproveche oportunidades de aprendizaje continuo',
        'Apto para roles de complejidad moderada',
        'Potencial para asumir responsabilidades adicionales',
      ];
    }

    return [
      'Candidato ideal para roles de alta complejidad',
      'Considere para posiciones de liderazgo',
      'Excelente capacidad de aprendizaje y adaptación',
      'Puede ser mentor para otros miembros del equipo',
    ];
  }
}
