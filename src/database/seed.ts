import { NestFactory } from '@nestjs/core';
import { SeederModule } from './seeders/seeder.module';
import { DatabaseSeeder } from './seeders/database.seeder';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeederModule);
  try {
    const seeder = app.get(DatabaseSeeder);
    await seeder.seed();
    console.log('✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Seeding failed!', error);
  } finally {
    await app.close();
  }
}

bootstrap();
