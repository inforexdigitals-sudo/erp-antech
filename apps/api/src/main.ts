import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('UNHANDLED REJECTION', reason);
});
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('UNCAUGHT EXCEPTION', err);
});

async function bootstrap(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('bootstrap() starting...');
  const app = await NestFactory.create(AppModule);
  // eslint-disable-next-line no-console
  console.log('NestFactory.create() resolved.');
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string[]>('corsOrigins'),
    credentials: true, // refresh token travels as an httpOnly cookie — see modules/auth/auth.controller.ts
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip any field not declared on the DTO
      forbidNonWhitelisted: true, // ...and reject the request instead of silently dropping it
      transform: true, // apply @Type()-driven coercion (e.g. numeric query params)
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  if (config.get<string>('nodeEnv') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Antech ERP API')
      .setDescription('Modules built so far: Auth, Quotations, Purchase Orders/Suppliers — see apps/api/README.md')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = config.get<number>('port') ?? 3000;
  // eslint-disable-next-line no-console
  console.log(`Calling app.listen(${port}) — process.env.PORT=${process.env.PORT}, API_PORT=${process.env.API_PORT}`);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Antech ERP API listening on :${port} (prefix /api/v1)`);
}

bootstrap();
