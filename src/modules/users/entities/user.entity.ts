import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  ManyToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UserRole } from '../../../common/enums/user-role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Exclude()
  @Column()
  password: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.WORKER,
  })
  role: UserRole;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_email_verified', default: false })
  isEmailVerified: boolean;

  @Column({ name: 'last_login', type: 'timestamp', nullable: true })
  lastLogin: Date;

  @Column({
    type: 'jsonb',
    default: {
      emailNotifications: true,
      newProcesses: true,
      applicationUpdates: true,
      testReminders: true,
      newEvaluations: true,
      candidateUpdates: true,
      processReminders: true,
    },
    name: 'notification_preferences',
  })
  notificationPreferences: {
    emailNotifications?: boolean;
    newProcesses?: boolean;
    applicationUpdates?: boolean;
    testReminders?: boolean;
    newEvaluations?: boolean;
    candidateUpdates?: boolean;
    processReminders?: boolean;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string;

  @OneToOne('Company', 'user', { nullable: true })
  company?: any;

  @ManyToOne('Company', { nullable: true })
  @JoinColumn({ name: 'company_id' })
  belongsToCompany?: any;

  @OneToOne('Worker', 'user', { nullable: true })
  worker?: any;

  @OneToMany('SelectionProcess', 'createdBy')
  createdProcesses?: any[];

  @ManyToMany('SelectionProcess', 'evaluators')
  evaluatedProcesses?: any[];

  @OneToMany('Report', 'createdBy')
  createdReports?: any[];

  @OneToMany('AuditLog', 'user')
  auditLogs?: any[];

  @OneToMany('Notification', 'user')
  notifications?: any[];
}
