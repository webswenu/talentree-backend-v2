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
import { Worker } from './worker.entity';
import { SelectionProcess } from '../../processes/entities/selection-process.entity';
import { WorkerStatus } from '../../../common/enums/worker-status.enum';
import { TestResponse } from '../../test-responses/entities/test-response.entity';

@Entity('worker_processes')
export class WorkerProcess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: WorkerStatus,
    default: WorkerStatus.PENDING,
  })
  status: WorkerStatus;

  @Column({ type: 'date', nullable: true })
  appliedAt: Date;

  @Column({ type: 'date', nullable: true })
  evaluatedAt: Date;

  @Column({ type: 'int', nullable: true })
  totalScore: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => Worker, (worker) => worker.workerProcesses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'worker_id' })
  worker: Worker;

  @ManyToOne(() => SelectionProcess)
  @JoinColumn({ name: 'process_id' })
  process: SelectionProcess;

  @OneToMany(() => TestResponse, (testResponse) => testResponse.workerProcess)
  testResponses: TestResponse[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
