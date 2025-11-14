import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../../modules/users/enums/user-role.enum';

@Injectable()
export class UserSeeder {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async seed() {
    const users = [
      {
        firstName: 'Admin',
        lastName: 'Talentree',
        email: 'admin@talentree.com',
        password: await bcrypt.hash('admin123', 10),
        role: UserRole.ADMIN_TALENTREE,
        isActive: true,
      },
      {
        firstName: 'María',
        lastName: 'González',
        email: 'maria.gonzalez@pelambres.cl',
        password: await bcrypt.hash('company123', 10),
        role: UserRole.COMPANY,
        isActive: true,
      },
      {
        firstName: 'Carlos',
        lastName: 'Soto',
        email: 'carlos.soto@evaluador.com',
        password: await bcrypt.hash('evaluator123', 10),
        role: UserRole.EVALUATOR,
        isActive: true,
      },
      {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@trabajador.com',
        password: await bcrypt.hash('worker123', 10),
        role: UserRole.WORKER,
        isActive: true,
      },
      {
        firstName: 'Ana',
        lastName: 'Martínez',
        email: 'ana.martinez@codelco.cl',
        password: await bcrypt.hash('company123', 10),
        role: UserRole.COMPANY,
        isActive: true,
      },
      {
        firstName: 'Roberto',
        lastName: 'Silva',
        email: 'roberto.silva@evaluador.com',
        password: await bcrypt.hash('evaluator123', 10),
        role: UserRole.EVALUATOR,
        isActive: true,
      },
      {
        firstName: 'Patricia',
        lastName: 'López',
        email: 'patricia.lopez@trabajador.com',
        password: await bcrypt.hash('worker123', 10),
        role: UserRole.WORKER,
        isActive: true,
      },
      {
        firstName: 'Diego',
        lastName: 'Ramírez',
        email: 'diego.ramirez@trabajador.com',
        password: await bcrypt.hash('worker123', 10),
        role: UserRole.WORKER,
        isActive: true,
      },
      {
        firstName: 'Invitado',
        lastName: 'Demo',
        email: 'guest@demo.com',
        password: await bcrypt.hash('guest123', 10),
        role: UserRole.GUEST,
        isActive: true,
      },
    ];

    for (const userData of users) {
      const existingUser = await this.userRepository.findOne({
        where: { email: userData.email },
      });

      if (!existingUser) {
        const user = this.userRepository.create(userData);
        await this.userRepository.save(user);
        console.log(`✅ Usuario creado: ${userData.email}`);
      } else {
        console.log(`⚠️  Usuario ya existe: ${userData.email}`);
      }
    }
  }
}
