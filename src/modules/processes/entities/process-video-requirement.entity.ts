import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { SelectionProcess } from './selection-process.entity';

export interface VideoQuestion {
  order: number;
  question: string;
  displayAtSecond: number;
}

@Entity('process_video_requirements')
export class ProcessVideoRequirement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => SelectionProcess, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'process_id' })
  process: SelectionProcess;

  @Column({ name: 'process_id', unique: true })
  processId: string;

  @Column({
    name: 'is_required',
    type: 'boolean',
    default: false,
    comment: 'Whether video is required for this process',
  })
  isRequired: boolean;

  @Column({
    name: 'max_duration',
    type: 'integer',
    nullable: true,
    comment: 'Maximum video duration in seconds',
  })
  maxDuration: number | null;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Array of questions to display during video recording',
  })
  questions: VideoQuestion[] | null;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Instructions for the worker before recording',
  })
  instructions: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
