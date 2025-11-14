import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { SixteenPfSeeder } from './seeders/16pf.seeder';
import { DiscSeeder } from './seeders/disc.seeder';
import { WonderlicSeeder } from './seeders/wonderlic.seeder';
import { CfrSeeder } from './seeders/cfr.seeder';
import { IcSeeder } from './seeders/ic.seeder';
import { TacSeeder } from './seeders/tac.seeder';

// Load environment variables
config();

// Create DataSource
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'talentree',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
  logging: false,
});

async function seedFixedTests() {
  console.log('🌱 Starting Fixed Tests Seeding...\n');

  try {
    // Initialize DataSource
    await AppDataSource.initialize();
    console.log('✅ Database connection established\n');

    // Run 16PF Seeder
    await SixteenPfSeeder.run(AppDataSource);
    console.log('');

    // Run DISC Seeder
    await DiscSeeder.run(AppDataSource);
    console.log('');

    // Run Wonderlic Seeder
    await WonderlicSeeder.run(AppDataSource);
    console.log('');

    // Run CFR Seeder
    await CfrSeeder.run(AppDataSource);
    console.log('');

    // Run IC Seeder
    await IcSeeder.run(AppDataSource);
    console.log('');

    // Run TAC Seeder
    await TacSeeder.run(AppDataSource);
    console.log('');

    console.log('✅ All fixed tests seeded successfully!\n');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

seedFixedTests();
