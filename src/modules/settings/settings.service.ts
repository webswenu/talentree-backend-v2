import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Setting } from './entities/setting.entity';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {}

  /**
   * P-46. La configuracion del sistema nacia vacia y solo se poblaba llamando
   * a mano a POST /settings/initialize, un paso que no estaba documentado en
   * ningun sitio y que en la practica nadie ejecutaba: la pantalla de
   * configuracion aparecia en blanco en toda instalacion nueva.
   *
   * Se siembra al arrancar el modulo. Es seguro hacerlo siempre porque
   * initializeDefaults solo crea los ajustes que faltan y nunca pisa los que
   * ya existen, asi que no deshace lo que la clienta haya cambiado.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.initializeDefaults();
    } catch (error) {
      // Que falle la siembra no debe impedir que el backend arranque.
      this.logger.error(
        `No se pudieron sembrar los ajustes por defecto: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async findAll(): Promise<Setting[]> {
    return this.settingRepository.find({
      order: { key: 'ASC' },
    });
  }

  async findPublic(): Promise<Setting[]> {
    return this.settingRepository.find({
      where: { isPublic: true },
      order: { key: 'ASC' },
    });
  }

  async findByKey(key: string): Promise<Setting | null> {
    return this.settingRepository.findOne({
      where: { key },
    });
  }

  async findByKeys(keys: string[]): Promise<Setting[]> {
    return this.settingRepository.find({
      where: { key: In(keys) },
    });
  }

  async upsert(updateSettingDto: UpdateSettingDto): Promise<Setting> {
    const { key, value, description, isPublic } = updateSettingDto;

    let setting = await this.findByKey(key);

    if (setting) {
      setting.value = value;
      if (description !== undefined) setting.description = description;
      if (isPublic !== undefined) setting.isPublic = isPublic;
    } else {
      setting = this.settingRepository.create({
        key,
        value,
        description,
        isPublic: isPublic ?? false,
      });
    }

    return this.settingRepository.save(setting);
  }

  async upsertBatch(settings: UpdateSettingDto[]): Promise<Setting[]> {
    const results = [];
    for (const settingDto of settings) {
      const result = await this.upsert(settingDto);
      results.push(result);
    }
    return results;
  }

  async delete(key: string): Promise<void> {
    await this.settingRepository.delete({ key });
  }

  async getGeneralSettings(): Promise<Record<string, any>> {
    const keys = [
      'system_name',
      'contact_email',
      'system_description',
      'timezone',
      'logo_url',
    ];
    const settings = await this.findByKeys(keys);
    return this.settingsToObject(settings);
  }

  async getNotificationSettings(): Promise<Record<string, any>> {
    const keys = [
      'notifications_enabled',
      'email_notifications',
      'in_app_notifications',
      'notification_frequency',
    ];
    const settings = await this.findByKeys(keys);
    return this.settingsToObject(settings);
  }

  private settingsToObject(settings: Setting[]): Record<string, any> {
    const result: Record<string, any> = {};
    settings.forEach((setting) => {
      result[setting.key] = setting.value;
    });
    return result;
  }

  async initializeDefaults(): Promise<void> {
    const defaults: UpdateSettingDto[] = [
      {
        key: 'system_name',
        value: 'Talentree',
        description: 'Nombre del sistema',
        isPublic: true,
      },
      {
        key: 'contact_email',
        value: 'contacto@talentree.com',
        description: 'Email de contacto',
        isPublic: true,
      },
      {
        key: 'system_description',
        value: 'Sistema de gestión de procesos de selección',
        description: 'Descripción del sistema',
        isPublic: true,
      },
      {
        key: 'timezone',
        value: 'America/Santiago',
        description: 'Zona horaria del sistema',
      },
      {
        key: 'notifications_enabled',
        value: true,
        description: 'Notificaciones habilitadas',
      },
      {
        key: 'email_notifications',
        value: true,
        description: 'Notificaciones por email',
      },
      {
        key: 'in_app_notifications',
        value: true,
        description: 'Notificaciones en la aplicación',
      },
      {
        key: 'notification_frequency',
        value: 'instant',
        description: 'Frecuencia de notificaciones (instant, daily, weekly)',
      },
    ];

    for (const setting of defaults) {
      const existing = await this.findByKey(setting.key);
      if (!existing) {
        await this.upsert(setting);
      }
    }
  }
}
