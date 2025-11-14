import { Injectable } from '@nestjs/common';
import { ITestScoring, ITestSubmission } from '../shared/interfaces';
import {
  getIcInterpretation,
  getIcLevel,
} from './constants/ic-scoring.constant';

@Injectable()
export class IcScoringService {
  async scoreTest(
    submission: ITestSubmission,
    questions: any[],
  ): Promise<ITestScoring> {
    let correctMarks = 0;
    let totalMarks = 0;
    let incorrectMarks = 0;

    submission.answers.forEach((answer) => {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) return;

      const correctAnswer = question.correctAnswer;
      const userAnswer = answer.answer;

      // For IC test, count each correct checkbox mark
      // correctAnswer structure: { column1: [rowIds...], column2: [rowIds...], column3: [rowIds...] }
      if (
        typeof correctAnswer === 'object' &&
        !Array.isArray(correctAnswer) &&
        typeof userAnswer === 'object' &&
        !Array.isArray(userAnswer)
      ) {
        // Count total possible marks
        Object.keys(correctAnswer).forEach((columnKey) => {
          if (Array.isArray(correctAnswer[columnKey])) {
            totalMarks += correctAnswer[columnKey].length;
          }
        });

        // Compare each column
        Object.keys(correctAnswer).forEach((columnKey) => {
          const correctRowIds = correctAnswer[columnKey] || [];
          const userRowIds = userAnswer[columnKey] || [];

          // Count correct marks (user marked AND should be marked)
          userRowIds.forEach((rowId: number) => {
            if (correctRowIds.includes(rowId)) {
              correctMarks++;
            } else {
              incorrectMarks++;
            }
          });

          // Count missing marks (should be marked but user didn't mark)
          correctRowIds.forEach((rowId: number) => {
            if (!userRowIds.includes(rowId)) {
              incorrectMarks++;
            }
          });
        });
      }
    });

    const percentage = totalMarks > 0 ? (correctMarks / totalMarks) * 100 : 0;

    const rawScores = {
      correct: correctMarks,
      incorrect: incorrectMarks,
      total: totalMarks,
    };

    const scaledScores = {
      score: correctMarks,
      percentage: Math.round(percentage * 10) / 10,
    };

    const interpretation = getIcInterpretation(percentage);
    const level = getIcLevel(percentage);

    const completionTime =
      submission.completedAt.getTime() - submission.startedAt.getTime();

    return {
      rawScores,
      scaledScores,
      interpretation: {
        overallScore: correctMarks,
        categories: {
          level,
        },
        descriptions: {
          level: interpretation.description,
          characteristics: interpretation.characteristics.join('; '),
        },
        recommendations: interpretation.recommendations,
        metadata: {
          totalQuestions: questions.length,
          totalMarks,
          percentage,
        },
      },
      completionTime,
    };
  }

  private isCorrectAnswer(userAnswer: any, correctAnswer: any): boolean {
    if (Array.isArray(userAnswer) && Array.isArray(correctAnswer)) {
      if (userAnswer.length !== correctAnswer.length) {
        return false;
      }

      const sortedUser = [...userAnswer].sort();
      const sortedCorrect = [...correctAnswer].sort();

      return sortedUser.every((val, idx) => val === sortedCorrect[idx]);
    }

    if (
      typeof userAnswer === 'object' &&
      typeof correctAnswer === 'object' &&
      !Array.isArray(userAnswer)
    ) {
      const correctKeys = Object.keys(correctAnswer);
      const userKeys = Object.keys(userAnswer);

      if (userKeys.length !== correctKeys.length) {
        return false;
      }

      // For IC test: compare arrays inside the object (column1, column2, column3)
      return correctKeys.every((key) => {
        const userVal = userAnswer[key];
        const correctVal = correctAnswer[key];

        // If both values are arrays, compare them properly
        if (Array.isArray(userVal) && Array.isArray(correctVal)) {
          if (userVal.length !== correctVal.length) {
            return false;
          }
          const sortedUser = [...userVal].sort((a, b) => a - b);
          const sortedCorrect = [...correctVal].sort((a, b) => a - b);
          return sortedUser.every((val, idx) => val === sortedCorrect[idx]);
        }

        // Otherwise, compare directly
        return userVal === correctVal;
      });
    }

    return userAnswer === correctAnswer;
  }
}
