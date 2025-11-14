import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../modules/companies/entities/company.entity';

@Injectable()
export class CompanySeeder {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  async seed() {
    const companies = [
      {
        name: 'Minera Los Pelambres',
        businessName: 'Minera Los Pelambres S.A.',
        rut: '96.790.240-3',
        email: 'contacto@pelambres.cl',
        phone: '+56 2 2756 8000',
        address: 'Av. Apoquindo 4001, Las Condes, Santiago',
        isActive: true,
        contactPerson: {
          name: 'María González',
          email: 'maria.gonzalez@pelambres.cl',
          phone: '+56 9 8765 4321',
        },
      },
      {
        name: 'Codelco El Teniente',
        businessName: 'Corporación Nacional del Cobre de Chile',
        rut: '61.704.000-K',
        email: 'contacto@codelco.cl',
        phone: '+56 2 2690 3000',
        address: 'Huérfanos 1270, Santiago',
        isActive: true,
        contactPerson: {
          name: 'Ana Martínez',
          email: 'ana.martinez@codelco.cl',
          phone: '+56 9 7654 3210',
        },
      },
      {
        name: 'Antofagasta Minerals',
        businessName: 'Antofagasta Minerals S.A.',
        rut: '76.534.860-4',
        email: 'contacto@aminerals.cl',
        phone: '+56 2 2798 7000',
        address: 'Apoquindo 4001, Piso 18, Las Condes',
        isActive: true,
        contactPerson: {
          name: 'Pedro Rojas',
          email: 'pedro.rojas@aminerals.cl',
          phone: '+56 9 6543 2109',
        },
      },
      {
        name: 'BHP Escondida',
        businessName: 'Minera Escondida Limitada',
        rut: '79.553.760-6',
        email: 'contacto@bhp.cl',
        phone: '+56 55 2209 5000',
        address: 'Av. de la Minería 501, Antofagasta',
        isActive: true,
        contactPerson: {
          name: 'Carmen Flores',
          email: 'carmen.flores@bhp.cl',
          phone: '+56 9 5432 1098',
        },
      },
      {
        name: 'Anglo American Sur',
        businessName: 'Anglo American Sur S.A.',
        rut: '96.537.940-9',
        email: 'contacto@angloamerican.cl',
        phone: '+56 2 2798 7878',
        address: 'Av. El Golf 150, Piso 17, Las Condes',
        isActive: true,
        contactPerson: {
          name: 'Luis Vargas',
          email: 'luis.vargas@angloamerican.cl',
          phone: '+56 9 4321 0987',
        },
      },
      {
        name: 'Minera Los Bronces',
        businessName: 'Anglo American Sur - División Los Bronces',
        rut: '96.537.940-9',
        email: 'losbronces@angloamerican.cl',
        phone: '+56 2 2887 5000',
        address: 'Camino a Los Bronces s/n, Til Til',
        isActive: true,
        contactPerson: {
          name: 'Sofía Castro',
          email: 'sofia.castro@angloamerican.cl',
          phone: '+56 9 3210 9876',
        },
      },
    ];

    for (const companyData of companies) {
      const existingCompany = await this.companyRepository.findOne({
        where: { rut: companyData.rut },
      });

      if (!existingCompany) {
        const company = this.companyRepository.create(companyData);
        await this.companyRepository.save(company);
        console.log(`✅ Empresa creada: ${companyData.name}`);
      } else {
        console.log(`⚠️  Empresa ya existe: ${companyData.name}`);
      }
    }
  }
}
