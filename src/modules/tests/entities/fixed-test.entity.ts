import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { FixedTestCode } from '../shared/enums';
import { FixedTestQuestion } from './fixed-test-question.entity';

@Entity('fixed_tests')
export class FixedTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
    nullable: false,
  })
  code: FixedTestCode;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  name: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string;

  @Column({
    type: 'integer',
    nullable: true,
    comment: 'Duration in minutes',
  })
  duration: number;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive: boolean;

  @Column({
    name: 'order_index',
    type: 'integer',
    nullable: true,
  })
  orderIndex: number;

  @Column({
    type: 'jsonb',
    nullable: false,
    comment:
      'Test-specific configuration (scoring rules, normative tables, etc.)',
  })
  configuration: Record<string, any>;

  @OneToMany(() => FixedTestQuestion, (question) => question.fixedTest, {
    cascade: true,
  })
  questions: FixedTestQuestion[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
