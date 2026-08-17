import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserSeeder } from './user.seeder';
import { CompanySeeder } from './company.seeder';
import { ProcessSeeder } from './process.seeder';
import { TestSeeder } from './test.seeder';
import { RelationsSeeder } from './relations.seeder';
import { SixteenPfSeeder } from './16pf.seeder';
import { DiscSeeder } from './disc.seeder';
import { WonderlicSeeder } from './wonderlic.seeder';
import { CfrSeeder } from './cfr.seeder';
import { IcSeeder } from './ic.seeder';
import { TacSeeder } from './tac.seeder';

@Injectable()
export class DatabaseSeeder {
  constructor(
    private readonly userSeeder: UserSeeder,
    private readonly companySeeder: CompanySeeder,
    private readonly processSeeder: ProcessSeeder,
    private readonly testSeeder: TestSeeder,
    private readonly relationsSeeder: RelationsSeeder,
    private readonly dataSource: DataSource,
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

      // P-64: los tests fijos son los que de verdad se usan en los procesos, y
      // estaban en un comando aparte (seed:fixed-tests) que había que recordar
      // ejecutar. En una instalación nueva el catálogo salía vacío.
      console.log('🧠 Seeding tests fijos (16PF, DISC, Wonderlic, CFR, IC, TAC)...');
      await SixteenPfSeeder.run(this.dataSource);
      await DiscSeeder.run(this.dataSource);
      await WonderlicSeeder.run(this.dataSource);
      await CfrSeeder.run(this.dataSource);
      await IcSeeder.run(this.dataSource);
      await TacSeeder.run(this.dataSource);
      console.log('');

      // P-21 y P-23: va al final, cuando ya existen usuarios, empresas y
      // procesos que vincular entre sí.
      console.log('🔗 Vinculando usuarios, empresas y trabajadores...');
      await this.relationsSeeder.seed();
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
