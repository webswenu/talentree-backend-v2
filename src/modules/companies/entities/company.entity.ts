import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true, nullable: true })
  rut: string;

  @Column({ nullable: true })
  industry: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ default: 'Chile' })
  country: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'contract_start_date', type: 'date', nullable: true })
  contractStartDate: Date;

  @Column({ name: 'contract_end_date', type: 'date', nullable: true })
  contractEndDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * Representante de la empresa.
   *
   * Era @OneToOne, que ademas del tipo imponia un indice UNIQUE sobre
   * `user_id`: una persona no podia representar a dos empresas. Ahora es
   * ManyToOne —la empresa sigue teniendo un solo representante, pero el
   * representante puede tener varias empresas— y la columna admite null,
   * porque una empresa puede existir antes de que se sepa quien la representa.
   */
  // El nombre del indice va explicito para que coincida con el que crea la
  // migracion: si no, TypeORM lo ve como ajeno y propone recrearlo cada vez.
  @Index('IDX_companies_user_id')
  @ManyToOne(() => User, (user) => user.companies, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
