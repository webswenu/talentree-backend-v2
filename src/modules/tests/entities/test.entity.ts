import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  ManyToMany,
} from 'typeorm';
import { TestType } from '../../../common/enums/test-type.enum';
import { User } from '../../users/entities/user.entity';
import { TestQuestion } from './test-question.entity';
import { SelectionProcess } from '../../processes/entities/selection-process.entity';

@Entity('tests')
export class Test {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: TestType })
  type: TestType;

  @Column({ type: 'int', nullable: true })
  duration: number;

  @Column({ type: 'int', nullable: true })
  passingScore: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  requiresManualReview: boolean;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @OneToMany(() => TestQuestion, (question) => question.test, { cascade: true })
  questions: TestQuestion[];

  @ManyToMany(() => SelectionProcess, (process) => process.tests)
  processes: SelectionProcess[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
