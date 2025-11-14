export interface ITestScoring {
  rawScores: Record<string, number>;
  scaledScores?: Record<string, number>;
  interpretation: ITestInterpretation;
  completionTime?: number;
}

export interface ITestInterpretation {
  overallScore?: number;
  categories?: Record<string, string>;
  descriptions?: Record<string, string>;
  recommendations?: string[];
  metadata?: Record<string, any>;
}

export interface INormativeTableEntry {
  factor: string;
  rawScore: number;
  scaledScore: number;
  interpretation?: string;
}

export interface ITestQuestionAnswer {
  questionId: string;
  questionNumber?: number;
  answer: any;
  factor?: string;
  timeTaken?: number;
}

export interface ITestSubmission {
  testId: string;
  workerId: string;
  workerProcessId: string;
  answers: ITestQuestionAnswer[];
  startedAt: Date;
  completedAt: Date;
  metadata?: Record<string, any>;
}
