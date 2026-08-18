import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { WorkerProcess } from './worker-process.entity';

@Entity('workers')
export class Worker {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  rut: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'date', nullable: true })
  birthDate: Date;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  region: string;

  @Column({ nullable: true })
  education: string;

  @Column({ type: 'text', nullable: true })
  experience: string;

  @Column({ type: 'jsonb', nullable: true })
  skills: string[];

  @Column({ nullable: true })
  cvUrl: string;

  /**
   * Borrar la cuenta NO borra al candidato: la ficha queda, sin usuario.
   *
   * Estaba en CASCADE y contradecia a la migracion
   * AddOnDeleteSetNullToWorkerUser, que pide SET NULL. Con `synchronize`
   * encendido ganaba la entidad y la migracion se deshacia sola en el
   * siguiente arranque, que es la razon por la que esa migracion nunca cuajo.
   *
   * Se resuelve a favor de SET NULL, que es la mas conservadora: eliminar un
   * usuario no puede llevarse su historial de postulaciones, evaluaciones e
   * informes por un efecto de la base que nadie ve. El borrado deliberado
   * sigue existiendo, explicito, en UsersService.remove.
   */
  @OneToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => WorkerProcess, (workerProcess) => workerProcess.worker)
  workerProcesses: WorkerProcess[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
