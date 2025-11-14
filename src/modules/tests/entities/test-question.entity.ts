import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { QuestionType } from '../../../common/enums/question-type.enum';
import { Test } from './test.entity';

@Entity('test_questions')
export class TestQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'enum', enum: QuestionType })
  type: QuestionType;

  @Column({ type: 'jsonb', nullable: true })
  options: string[];

  @Column({ type: 'jsonb', nullable: true })
  correctAnswers: string[];

  @Column({ type: 'int', default: 1 })
  points: number;

  @Column({ type: 'int' })
  order: number;

  @Column({ type: 'boolean', default: true })
  isRequired: boolean;

  @ManyToOne(() => Test, (test) => test.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'test_id' })
  test: Test;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
