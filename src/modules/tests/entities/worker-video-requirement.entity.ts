import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Worker } from '../../workers/entities/worker.entity';
import { User } from '../../users/entities/user.entity';
import { SelectionProcess } from '../../processes/entities/selection-process.entity';
import { WorkerProcess } from '../../workers/entities/worker-process.entity';

export enum VideoRequirementStatus {
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RESUBMISSION_REQUIRED = 'resubmission_required',
}

@Entity('worker_video_requirements')
export class WorkerVideoRequirement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Worker, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'worker_id' })
  worker: Worker;

  @Column({ name: 'worker_id' })
  workerId: string;

  @ManyToOne(() => SelectionProcess, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'process_id' })
  process: SelectionProcess;

  @Column({ name: 'process_id' })
  processId: string;

  @ManyToOne(() => WorkerProcess, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'worker_process_id' })
  workerProcess: WorkerProcess;

  @Column({ name: 'worker_process_id', nullable: true })
  workerProcessId: string | null;

  @Column({
    name: 'video_url',
    type: 'varchar',
    length: 500,
    nullable: false,
  })
  videoUrl: string;

  @Column({
    name: 'video_duration',
    type: 'integer',
    nullable: true,
    comment: 'Duration in seconds',
  })
  videoDuration: number | null;

  @Column({
    name: 'video_size',
    type: 'bigint',
    nullable: true,
    comment: 'File size in bytes',
  })
  videoSize: number | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: VideoRequirementStatus.PENDING_REVIEW,
  })
  status: VideoRequirementStatus;

  @Column({
    name: 'review_notes',
    type: 'text',
    nullable: true,
  })
  reviewNotes: string | null;

  @Column({
    name: 'reviewed_at',
    type: 'timestamp',
    nullable: true,
  })
  reviewedAt: Date | null;

  @ManyToOne(() => User, {
    nullable: true,
  })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedBy: User | null;

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedById: string | null;

  @Column({
    name: 'recorded_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  recordedAt: Date;

  @Column({
    name: 'device_info',
    type: 'jsonb',
    nullable: true,
    comment: 'Browser, device, OS information',
  })
  deviceInfo: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
