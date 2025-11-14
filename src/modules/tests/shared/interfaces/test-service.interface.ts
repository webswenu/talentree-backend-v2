import { ITestScoring, ITestSubmission } from './test-scoring.interface';
import { FixedTest } from '../../entities/fixed-test.entity';

export interface ITestService {
  getTest(): Promise<FixedTest>;

  scoreTest(submission: ITestSubmission): Promise<ITestScoring>;

  validateAnswers(submission: ITestSubmission): Promise<boolean>;

  getTestInstructions(): Promise<any>;
}
