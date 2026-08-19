import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { TodasLasExcepcionesFilter } from './common/filters/todas-las-excepciones.filter';
import { excepcionDeValidacionEnEspanol } from './common/validators/validation-messages';
import { AuditService } from './modules/audit/audit.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files from uploads directory with proper MIME types
  // IMPORTANT: This must be BEFORE setGlobalPrefix to serve files without /api/v1 prefix
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
    setHeaders: (res, filePath) => {
      // Set proper Content-Type for video files
      if (filePath.endsWith('.mp4')) {
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=3600');
      } else if (filePath.endsWith('.webm')) {
        res.setHeader('Content-Type', 'video/webm');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
    },
  });

  // Get Config Service
  const configService = app.get(ConfigService);

  // Global Prefix
  const apiPrefix = configService.get<string>('API_PREFIX') || 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // CORS - Allow access from frontend
  const corsOrigin = configService.get<string>('CORS_ORIGIN') || 'http://localhost:5173';
  // Support multiple origins separated by comma
  const allowedOrigins = corsOrigin.split(',').map(origin => origin.trim());
  
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      // P-18: la API respondia en ingles ('email must be an email'). Se traduce
      // aqui y no DTO por DTO, para que ningun DTO nuevo vuelva a nacer en
      // ingles. Los `message` propios de cada DTO siguen mandando.
      exceptionFactory: excepcionDeValidacionEnEspanol,
    }),
  );

  // Global Interceptors
  const auditService = app.get(AuditService);
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new TransformResponseInterceptor(),
    // P-42: recibe el ConfigService para saber cuál es el prefijo de la API y
    // poder quitarlo al deducir la entidad, en vez de asumir una posición fija.
    new AuditInterceptor(auditService, configService),
  );

  // Global Exception Filters
  //
  // Un solo filtro `@Catch()` para todo: por dentro deriva los errores de base
  // de datos al QueryFailedExceptionFilter. Se hace asi, y no registrando los
  // dos, para no depender del orden en que Nest los prueba. Sin este filtro,
  // el cuerpo JSON malformado, la ruta inexistente, el 413 y cualquier
  // excepcion que no sea HTTP salian con el texto por defecto del framework,
  // en ingles, y el front lo mostraba tal cual en un aviso.
  app.useGlobalFilters(new TodasLasExcepcionesFilter());

  // Port
  const port = configService.get<number>('PORT') || 3000;

  await app.listen(port);
  console.log(
    `🚀 Talentree Backend running on: http://localhost:${port}/${apiPrefix}`,
  );
}

bootstrap();
