import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SelectionProcess } from '../../processes/entities/selection-process.entity';
import { User } from '../../users/entities/user.entity';

export enum ProcessInvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

@Entity('process_invitations')
export class ProcessInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SelectionProcess)
  @JoinColumn({ name: 'process_id' })
  process: SelectionProcess;

  @Column()
  email: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ unique: true })
  token: string;

  @Column({
    type: 'enum',
    enum: ProcessInvitationStatus,
    default: ProcessInvitationStatus.PENDING,
  })
  status: ProcessInvitationStatus;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt: Date;

  @Column({ name: 'accepted_at', type: 'timestamp', nullable: true })
  acceptedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
