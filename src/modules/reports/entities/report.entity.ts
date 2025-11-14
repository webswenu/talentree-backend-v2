import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ReportType } from '../../../common/enums/report-type.enum';
import { ReportStatus } from '../../../common/enums/report-status.enum';
import { User } from '../../users/entities/user.entity';
import { SelectionProcess } from '../../processes/entities/selection-process.entity';
import { Worker } from '../../workers/entities/worker.entity';

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ReportType })
  type: ReportType;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 50,
    default: 'pending_approval',
  })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  content: Record<string, any>;

  // DOCX file (generado automáticamente)
  @Column({ nullable: true, name: 'docx_file_url' })
  docxFileUrl: string;

  @Column({ nullable: true, name: 'docx_file_name' })
  docxFileName: string;

  // PDF file (subido manualmente)
  @Column({ nullable: true, name: 'pdf_file_url' })
  pdfFileUrl: string;

  @Column({ nullable: true, name: 'pdf_file_name' })
  pdfFileName: string;

  // Mantener los campos antiguos para compatibilidad (deprecated)
  @Column({ nullable: true })
  fileUrl: string;

  @Column({ nullable: true })
  fileName: string;

  @Column({ type: 'date', nullable: true })
  generatedDate: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @ManyToOne(() => SelectionProcess, { nullable: true })
  @JoinColumn({ name: 'process_id' })
  process: SelectionProcess;

  @ManyToOne(() => Worker, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'worker_id' })
  worker: Worker;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy: User;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
