import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { TestQuestionType } from '../shared/enums';
import { FixedTest } from './fixed-test.entity';

@Entity('fixed_test_questions')
@Unique(['fixedTest', 'questionNumber'])
export class FixedTestQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FixedTest, (test) => test.questions, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'fixed_test_id' })
  fixedTest: FixedTest;

  @Column({ name: 'fixed_test_id' })
  fixedTestId: string;

  @Column({
    name: 'question_number',
    type: 'integer',
    nullable: false,
  })
  questionNumber: number;

  @Column({
    name: 'question_text',
    type: 'text',
    nullable: false,
  })
  questionText: string;

  @Column({
    name: 'question_type',
    type: 'varchar',
    length: 50,
    nullable: false,
  })
  questionType: TestQuestionType;

  @Column({
    type: 'jsonb',
    nullable: false,
    comment: 'Question options/alternatives (format depends on question type)',
  })
  options: Record<string, any>;

  @Column({
    name: 'correct_answer',
    type: 'jsonb',
    nullable: true,
    comment: 'Expected correct answer (for Wonderlic, IC)',
  })
  correctAnswer: Record<string, any> | null;

  @Column({
    type: 'varchar',
    length: 10,
    nullable: true,
    comment: 'Factor/dimension (for 16PF: A-Q4, for DISC: D/I/S/C)',
  })
  factor: string | null;

  @Column({
    type: 'integer',
    default: 1,
    comment: 'Points for correct answer (mainly for Wonderlic)',
  })
  points: number;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment:
      'Additional metadata (polarity for 16PF, word group for DISC, etc.)',
  })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
