import { Injectable } from '@nestjs/common';
import { UserSeeder } from './user.seeder';
import { CompanySeeder } from './company.seeder';
import { ProcessSeeder } from './process.seeder';
import { TestSeeder } from './test.seeder';

@Injectable()
export class DatabaseSeeder {
  constructor(
    private readonly userSeeder: UserSeeder,
    private readonly companySeeder: CompanySeeder,
    private readonly processSeeder: ProcessSeeder,
    private readonly testSeeder: TestSeeder,
  ) {}

  async seed() {
    console.log('🌱 Iniciando seeders...\n');

    try {
      console.log('👤 Seeding usuarios...');
      await this.userSeeder.seed();
      console.log('');

      console.log('🏢 Seeding empresas...');
      await this.companySeeder.seed();
      console.log('');

      console.log('📋 Seeding procesos...');
      await this.processSeeder.seed();
      console.log('');

      console.log('📝 Seeding tests...');
      await this.testSeeder.seed();
      console.log('');

      console.log('✅ Seeders completados exitosamente!\n');
      console.log('📊 Usuarios de prueba creados:');
      console.log('   Admin:     admin@talentree.com / admin123');
      console.log('   Empresa:   maria.gonzalez@pelambres.cl / company123');
      console.log('   Evaluador: carlos.soto@evaluador.com / evaluator123');
      console.log('   Worker:    juan.perez@trabajador.com / worker123');
      console.log('   Guest:     guest@demo.com / guest123\n');
    } catch (error) {
      console.error('❌ Error ejecutando seeders:', error);
      throw error;
    }
  }
}
