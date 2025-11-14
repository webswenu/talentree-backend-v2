import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SelectionProcess } from '../../modules/processes/entities/selection-process.entity';
import { Company } from '../../modules/companies/entities/company.entity';
import { ProcessStatus } from '../../common/enums/process-status.enum';

@Injectable()
export class ProcessSeeder {
  constructor(
    @InjectRepository(SelectionProcess)
    private readonly processRepository: Repository<SelectionProcess>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  /** Helper para generar código único basado en el nombre */
  private generateCode(name: string): string {
    const prefix = name.trim().toUpperCase().replace(/\s+/g, '-').slice(0, 10);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${random}`;
  }

  /** Helper para obtener una empresa por índice, o la primera si no existe */
  private getCompany(companies: Company[], index: number): Company {
    if (!companies[index]) {
      console.warn(
        `⚠️  No existe empresa con índice ${index}, se usará la primera disponible.`,
      );
      return companies[0];
    }
    return companies[index];
  }

  async seed() {
    const companies = await this.companyRepository.find();

    if (companies.length === 0) {
      console.log(
        '⚠️  No hay empresas. Ejecuta primero el seeder de empresas.',
      );
      return;
    }

    const processes = [
      {
        name: 'Operadores de Mina Los Pelambres',
        position: 'Operador de Equipo Pesado',
        description:
          'Proceso de selección para operadores de equipos pesados en Mina Los Pelambres',
        department: 'Operaciones',
        location: 'Los Pelambres',
        maxWorkers: 15,
        startDate: new Date('2025-10-01'),
        endDate: new Date('2025-11-30'),
        status: ProcessStatus.ACTIVE,
        company: this.getCompany(companies, 0),
      },
      {
        name: 'Supervisores Turno Noche - El Teniente',
        position: 'Supervisor de Turno',
        description:
          'Búsqueda de supervisores para turno nocturno en División El Teniente',
        department: 'Supervisión',
        location: 'El Teniente',
        maxWorkers: 8,
        startDate: new Date('2025-09-15'),
        endDate: new Date('2025-11-15'),
        status: ProcessStatus.ACTIVE,
        company: this.getCompany(companies, 1),
      },
      {
        name: 'Mecánicos Especialistas - Antofagasta',
        position: 'Mecánico Industrial',
        description:
          'Selección de mecánicos especializados en equipos de gran minería',
        department: 'Mantenimiento',
        location: 'Antofagasta',
        maxWorkers: 12,
        startDate: new Date('2025-08-20'),
        endDate: new Date('2025-10-20'),
        status: ProcessStatus.CLOSED,
        company: this.getCompany(companies, 2),
      },
      {
        name: 'Operadores de Camión - Escondida',
        position: 'Operador de Camión CAT 797',
        description:
          'Contratación de operadores de camiones CAT 797 para Mina Escondida',
        department: 'Operaciones',
        location: 'Escondida',
        maxWorkers: 20,
        startDate: new Date('2025-10-10'),
        endDate: new Date('2025-12-10'),
        status: ProcessStatus.ACTIVE,
        company: this.getCompany(companies, 3),
      },
      {
        name: 'Geólogos Junior - Anglo American',
        position: 'Geólogo Junior',
        description: 'Programa de desarrollo para geólogos recién titulados',
        department: 'Geología',
        location: 'Santiago',
        maxWorkers: 5,
        startDate: new Date('2025-09-01'),
        endDate: new Date('2025-10-31'),
        status: ProcessStatus.ACTIVE,
        company: this.getCompany(companies, 4),
      },
      {
        name: 'Operadores de Pala - Los Bronces',
        position: 'Operador de Pala Hidráulica',
        description: 'Selección de operadores de palas hidráulicas',
        department: 'Operaciones',
        location: 'Los Bronces',
        maxWorkers: 10,
        startDate: new Date('2025-10-05'),
        endDate: new Date('2025-11-25'),
        status: ProcessStatus.ACTIVE,
        company: this.getCompany(companies, 5),
      },
      {
        name: 'Ingenieros de Procesos',
        position: 'Ingeniero de Procesos Metalúrgicos',
        description:
          'Búsqueda de ingenieros para área de procesos metalúrgicos',
        department: 'Procesos',
        location: 'Faena Norte',
        maxWorkers: 6,
        startDate: new Date('2025-07-15'),
        endDate: new Date('2025-09-15'),
        status: ProcessStatus.CLOSED,
        company: this.getCompany(companies, 0),
      },
      {
        name: 'Técnicos Eléctricos',
        position: 'Técnico Electricista',
        description: 'Contratación de técnicos para mantenimiento eléctrico',
        department: 'Mantenimiento',
        location: 'Faena Central',
        maxWorkers: 8,
        startDate: new Date('2025-11-01'),
        endDate: new Date('2025-12-31'),
        status: ProcessStatus.DRAFT,
        company: this.getCompany(companies, 1),
      },
    ];

    for (const data of processes) {
      const existing = await this.processRepository.findOne({
        where: {
          name: data.name,
          company: { id: data.company.id },
        },
      });

      if (!existing) {
        const process = this.processRepository.create({
          ...data,
          code: this.generateCode(data.name),
        });

        await this.processRepository.save(process);
        console.log(`✅ Proceso creado: ${data.name}`);
      } else {
        console.log(`⚠️  Proceso ya existe: ${data.name}`);
      }
    }
  }
}
