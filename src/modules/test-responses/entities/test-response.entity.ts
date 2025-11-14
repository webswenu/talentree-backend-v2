import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Test } from '../../tests/entities/test.entity';
import { FixedTest } from '../../tests/entities/fixed-test.entity';
import { WorkerProcess } from '../../workers/entities/worker-process.entity';
import { TestAnswer } from './test-answer.entity';

@Entity('test_responses')
export class TestResponse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'int', nullable: true })
  score: number;

  @Column({ type: 'int', nullable: true })
  maxScore: number;

  @Column({ type: 'boolean', default: false })
  passed: boolean;

  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @Column({ type: 'text', nullable: true })
  evaluatorNotes: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => Test)
  @JoinColumn({ name: 'test_id' })
  test: Test;

  @ManyToOne(() => FixedTest, { nullable: true })
  @JoinColumn({ name: 'fixed_test_id' })
  fixedTest: FixedTest;

  @Column({ name: 'fixed_test_id', nullable: true })
  fixedTestId: string;

  @Column({
    name: 'raw_scores',
    type: 'jsonb',
    nullable: true,
    comment: 'Raw scores per factor/dimension (for 16PF, DISC, etc.)',
  })
  rawScores: Record<string, any>;

  @Column({
    name: 'scaled_scores',
    type: 'jsonb',
    nullable: true,
    comment: 'Scaled scores (decatipos for 16PF, normalized for DISC, etc.)',
  })
  scaledScores: Record<string, any>;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Test interpretation results and categorizations',
  })
  interpretation: Record<string, any>;

  @ManyToOne(
    () => WorkerProcess,
    (workerProcess) => workerProcess.testResponses,
  )
  @JoinColumn({ name: 'worker_process_id' })
  workerProcess: WorkerProcess;

  @OneToMany(() => TestAnswer, (answer) => answer.testResponse, {
    cascade: true,
  })
  answers: TestAnswer[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
