import { CacheModuleOptions } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';

export const getRedisConfig = (
  configService: ConfigService,
): CacheModuleOptions => ({
  ttl: configService.get<number>('REDIS_TTL') || 300,
  isGlobal: true,
});
