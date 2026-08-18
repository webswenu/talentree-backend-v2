import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const parseBool = (value: string | boolean | undefined): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return false;
  };

  return {
    type: configService.get<string>('DB_TYPE') as any,
    host: configService.get<string>('DB_HOST'),
    port: Number(configService.get<number>('DB_PORT')),
    username: configService.get<string>('DB_USERNAME'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_DATABASE'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    /**
     * NUNCA en produccion, diga lo que diga la variable de entorno.
     *
     * `synchronize` deja que TypeORM cambie el esquema solo en cada arranque
     * comparandolo con las entidades. Es comodo en desarrollo y es un peligro
     * en produccion: renombrar una propiedad borra la columna vieja con los
     * datos dentro, y nadie lo pide ni lo aprueba.
     *
     * Ademas se lleva mal con las migraciones. El caso concreto que aparecio
     * aqui: la migracion AddOnDeleteSetNullToWorkerUser dejaba el borrado en
     * SET NULL y el siguiente arranque lo devolvia a CASCADE, porque asi lo
     * decia la entidad. La migracion se revertia sola y nadie se enteraba.
     *
     * El `docker-compose.yml` tenia default `true`, asi que bastaba con que el
     * .env no lo mencionara para que produccion corriera asi.
     */
    synchronize:
      configService.get('NODE_ENV') === 'production'
        ? false
        : parseBool(configService.get('DB_SYNCHRONIZE')),
    logging: parseBool(configService.get('DB_LOGGING')),
    dropSchema: parseBool(configService.get('DB_DROP_SCHEMA')),
    autoLoadEntities: true,
  };
};
