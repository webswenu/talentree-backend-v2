import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { ProcessStatus } from '../../../common/enums/process-status.enum';
import { Company } from '../../companies/entities/company.entity';
import { User } from '../../users/entities/user.entity';
import { Test } from '../../tests/entities/test.entity';
import { FixedTest } from '../../tests/entities/fixed-test.entity';

@Entity('selection_processes')
export class SelectionProcess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  position: string;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  location: string;

  @Column({
    type: 'enum',
    enum: ProcessStatus,
  })
  status: ProcessStatus;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date;

  @Column({ name: 'max_workers', type: 'int', nullable: true })
  maxWorkers: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @ManyToMany(() => User)
  @JoinTable({
    name: 'process_evaluators',
    joinColumn: { name: 'process_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  evaluators: User[];

  @ManyToMany(() => Test, (test) => test.processes)
  @JoinTable({
    name: 'process_tests',
    joinColumn: { name: 'process_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'test_id', referencedColumnName: 'id' },
  })
  tests: Test[];

  @ManyToMany(() => FixedTest)
  @JoinTable({
    name: 'process_fixed_tests',
    joinColumn: { name: 'process_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'fixed_test_id', referencedColumnName: 'id' },
  })
  fixedTests: FixedTest[];
}
