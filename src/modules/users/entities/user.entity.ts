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

  /**
   * Empresas que este usuario REPRESENTA.
   *
   * Era uno a uno (`companies.user_id` con indice unico). Paso a varias porque
   * una misma persona puede ser la contraparte de mas de una empresa —el caso
   * tipico es un holding con dos RUT—, y antes eso obligaba a inventarle una
   * cuenta y un correo por empresa.
   */
  @OneToMany('Company', 'user')
  companies?: any[];

  /**
   * Empresa sobre la que el usuario esta operando en esta sesion.
   *
   * Es un puntero, no una relacion: el aislamiento entre empresas sigue
   * trabajando con UNA empresa a la vez (ver ownership.helper), y lo unico que
   * cambia respecto del modelo anterior es QUIEN la elige. Mantenerlo asi es
   * lo que permite que ni las consultas ni las pantallas se enteren de que
   * ahora puede haber varias.
   */
  @Column({ name: 'active_company_id', type: 'uuid', nullable: true })
  activeCompanyId: string;

  /**
   * La misma columna, declarada tambien como relacion.
   *
   * No es un duplicado por descuido: sin esto TypeORM no sabe que
   * `active_company_id` tiene una clave foranea, y cada `migration:generate`
   * propone borrarla. El mismo patron ya se usa mas abajo con `companyId` y
   * `belongsToCompany`.
   *
   * Nadie la carga: la empresa activa se resuelve desde `companies` en
   * UsersService. Existe para que el esquema y las entidades digan lo mismo.
   */
  @ManyToOne('Company', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'active_company_id' })
  activeCompany?: any;

  /**
   * La empresa activa ya resuelta. NO se persiste: la llena el servicio al
   * cargar al usuario (findOneWithRelations). Existe para que
   * `resolveUserCompanyId(user)` y las pantallas sigan leyendo `user.company`
   * como un objeto unico, igual que antes.
   */
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
