import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { Company } from '../../modules/companies/entities/company.entity';
import { Worker } from '../../modules/workers/entities/worker.entity';
import { WorkerProcess } from '../../modules/workers/entities/worker-process.entity';
import { SelectionProcess } from '../../modules/processes/entities/selection-process.entity';
import { UserRole } from '../../modules/users/enums/user-role.enum';
import { WorkerStatus } from '../../common/enums/worker-status.enum';

/**
 * Vínculos entre las entidades sembradas (hallazgos P-21 y P-23).
 *
 * El seed dejaba el ambiente inutilizable para tres de los cinco roles:
 *
 *  P-21: creaba usuarios con rol WORKER pero ningún perfil de trabajador, así
 *        que el bloque completo de casos del candidato no se podía ejecutar.
 *        El rodeo que usó QA fue registrar un trabajador por la API pública.
 *
 *  P-23: creaba empresas sin representante y no ligaba el usuario invitado a
 *        ninguna empresa, así que los roles Empresa e Invitado entraban a un
 *        panel vacío que decía "no tienes empresa asignada".
 *
 * Se siembran además algunas postulaciones en distintos estados: sin ellas no
 * hay forma de probar los filtros de la tabla de candidatos, que era otro de
 * los puntos ciegos del ambiente de pruebas.
 *
 * Todo es idempotente: solo crea lo que falta, nunca pisa lo que ya existe.
 */
@Injectable()
export class RelationsSeeder {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Worker)
    private readonly workerRepository: Repository<Worker>,
    @InjectRepository(WorkerProcess)
    private readonly workerProcessRepository: Repository<WorkerProcess>,
    @InjectRepository(SelectionProcess)
    private readonly processRepository: Repository<SelectionProcess>,
  ) {}

  async seed(): Promise<void> {
    await this.crearPerfilesDeTrabajador();
    await this.asignarRepresentantes();
    await this.ligarInvitados();
    await this.sembrarPostulaciones();
  }

  /** P-21: un usuario con rol WORKER necesita su ficha de trabajador. */
  private async crearPerfilesDeTrabajador(): Promise<void> {
    const usuarios = await this.userRepository.find({
      where: { role: UserRole.WORKER },
      relations: ['worker'],
    });

    // La columna rut es UNIQUE, así que una lista fija de RUT choca en cuanto
    // el ambiente ya tiene datos (pasó al ejecutar este seeder por primera vez
    // sobre la base de QA). Se generan sobre la marcha y se saltan los tomados.
    const rutsTomados = new Set(
      (await this.workerRepository.find({ select: ['rut'] })).map((w) => w.rut),
    );

    let siguiente = 10000000;

    for (const usuario of usuarios) {
      if (usuario.worker) {
        console.log(`⚠️  Perfil de trabajador ya existe: ${usuario.email}`);
        continue;
      }

      const rut = this.siguienteRutLibre(rutsTomados, () => siguiente++);

      if (!rut) {
        console.log(`⚠️  No se encontró un RUT libre para ${usuario.email}`);
        continue;
      }

      rutsTomados.add(rut);

      const worker = this.workerRepository.create({
        firstName: usuario.firstName,
        lastName: usuario.lastName,
        email: usuario.email,
        rut,
        user: usuario,
      });

      await this.workerRepository.save(worker);
      console.log(`✅ Perfil de trabajador creado: ${usuario.email} (${rut})`);
    }
  }

  /** Primer RUT válido que no esté ya en uso. */
  private siguienteRutLibre(
    tomados: Set<string>,
    siguienteCuerpo: () => number,
  ): string | null {
    // Cota de seguridad: evita un bucle infinito si algo va mal.
    for (let intentos = 0; intentos < 1000; intentos++) {
      const cuerpo = siguienteCuerpo();
      const rut = `${cuerpo}-${RelationsSeeder.digitoVerificador(cuerpo)}`;
      if (!tomados.has(rut)) return rut;
    }
    return null;
  }

  /**
   * Dígito verificador por módulo 11, la misma regla que valida el backend
   * desde P-51. Sin esto, los trabajadores sembrados no pasarían su propia
   * validación al editarlos desde el panel.
   */
  private static digitoVerificador(cuerpo: number): string {
    const digitos = String(cuerpo).split('').reverse();

    let suma = 0;
    let multiplicador = 2;

    for (const d of digitos) {
      suma += parseInt(d, 10) * multiplicador;
      multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
    }

    const resto = 11 - (suma % 11);
    return resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  }

  /**
   * P-23: cada usuario con rol COMPANY pasa a representar una empresa.
   * La relación es uno a uno, así que se empareja de a uno y sin repetir.
   */
  private async asignarRepresentantes(): Promise<void> {
    const empresasSinRepresentante = await this.companyRepository.find({
      where: { user: IsNull() },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });

    const usuariosEmpresa = await this.userRepository.find({
      where: { role: UserRole.COMPANY },
      relations: ['company'],
      order: { createdAt: 'ASC' },
    });

    const libres = usuariosEmpresa.filter((u) => !u.company);

    for (const [i, empresa] of empresasSinRepresentante.entries()) {
      // Si no quedan usuarios COMPANY libres, se crea uno.
      //
      // No es un capricho del seed: sin AL MENOS DOS empresas con
      // representante no hay forma de probar el aislamiento entre empresas
      // (P-22), que es el hallazgo crítico del QA. El ambiente de pruebas
      // tiene que permitir reproducirlo.
      const usuario = libres[i] ?? (await this.crearUsuarioEmpresa(empresa));

      if (!usuario) break;

      empresa.user = usuario;
      await this.companyRepository.save(empresa);
      console.log(
        `✅ Representante asignado: ${usuario.email} -> ${empresa.name}`,
      );
    }
  }

  /** Crea un representante para una empresa que se quedó sin usuarios libres. */
  private async crearUsuarioEmpresa(empresa: Company): Promise<User | null> {
    // Correo derivado del nombre de la empresa, estable entre ejecuciones.
    const slug = empresa.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.|\.$/g, '');

    const email = `representante.${slug}@talentree.demo`;

    const existente = await this.userRepository.findOne({ where: { email } });
    if (existente) return existente;

    const usuario = this.userRepository.create({
      firstName: 'Representante',
      lastName: empresa.name,
      email,
      // Se hashea de verdad: un usuario sembrado con un hash inventado no
      // puede iniciar sesión, que es justo para lo que se necesita.
      password: await bcrypt.hash('company123', 10),
      role: UserRole.COMPANY,
      isActive: true,
    });

    return this.userRepository.save(usuario);
  }

  /** P-23: el usuario invitado tiene que pertenecer a alguna empresa. */
  private async ligarInvitados(): Promise<void> {
    const invitados = await this.userRepository.find({
      where: { role: UserRole.GUEST },
    });

    const empresa = await this.companyRepository.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });

    if (!empresa) {
      console.log('⚠️  No hay empresas: no se pudo ligar a los invitados');
      return;
    }

    for (const invitado of invitados) {
      if (invitado.companyId) {
        console.log(`⚠️  Invitado ya ligado a una empresa: ${invitado.email}`);
        continue;
      }

      invitado.companyId = empresa.id;
      await this.userRepository.save(invitado);
      console.log(`✅ Invitado ligado a ${empresa.name}: ${invitado.email}`);
    }
  }

  /**
   * Postulaciones en distintos estados, para poder probar los filtros de la
   * tabla de candidatos y las tarjetas de resumen del panel de empresa.
   */
  private async sembrarPostulaciones(): Promise<void> {
    const existentes = await this.workerProcessRepository.count();
    if (existentes > 0) {
      console.log(
        `⚠️  Ya hay ${existentes} postulacion(es): no se siembran mas`,
      );
      return;
    }

    const trabajadores = await this.workerRepository.find({ take: 4 });
    const procesos = await this.processRepository.find({ take: 4 });

    if (trabajadores.length === 0 || procesos.length === 0) {
      console.log('⚠️  Faltan trabajadores o procesos: no se siembran postulaciones');
      return;
    }

    const estados = [
      WorkerStatus.PENDING,
      WorkerStatus.IN_PROCESS,
      WorkerStatus.APPROVED,
      WorkerStatus.REJECTED,
    ];

    for (const [i, trabajador] of trabajadores.entries()) {
      const proceso = procesos[i % procesos.length];

      const postulacion = this.workerProcessRepository.create({
        worker: trabajador,
        process: proceso,
        status: estados[i % estados.length],
        // P-40: con fecha, como toda postulación.
        appliedAt: new Date(),
      });

      await this.workerProcessRepository.save(postulacion);
      console.log(
        `✅ Postulacion sembrada: ${trabajador.email} -> ${proceso.name} (${estados[i % estados.length]})`,
      );
    }
  }
}
