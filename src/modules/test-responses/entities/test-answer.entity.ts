import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TestResponse } from './test-response.entity';
import { TestQuestion } from '../../tests/entities/test-question.entity';
import { FixedTestQuestion } from '../../tests/entities/fixed-test-question.entity';

@Entity('test_answers')
export class TestAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb', nullable: true })
  answer: any;

  @Column({ type: 'int', nullable: true })
  score: number;

  @Column({ type: 'boolean', default: false })
  isCorrect: boolean;

  @Column({ type: 'text', nullable: true })
  evaluatorComment: string;

  @ManyToOne(() => TestResponse, (testResponse) => testResponse.answers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'test_response_id' })
  testResponse: TestResponse;

  @ManyToOne(() => TestQuestion)
  @JoinColumn({ name: 'question_id' })
  question: TestQuestion;

  @ManyToOne(() => FixedTestQuestion, { nullable: true })
  @JoinColumn({ name: 'fixed_test_question_id' })
  fixedTestQuestion: FixedTestQuestion;

  @Column({ name: 'fixed_test_question_id', nullable: true })
  fixedTestQuestionId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
