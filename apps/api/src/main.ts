import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { initSentry } from './config/sentry.js';
import { AppModule } from './app.module.js';
import { ProblemDetailsFilter } from './common/problem-details.filter.js';

async function bootstrap(): Promise<void> {
  initSentry();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);

  app.use(helmet());
  app.enableCors({
    origin: config.get<string>('CORS_ORIGINS', '*').split(','),
    credentials: true,
  });
  app.setGlobalPrefix('v1', { exclude: ['health', 'healthz', 'readyz'] });
  app.useGlobalFilters(
    new ProblemDetailsFilter(config.get<string>('PUBLIC_API_URL', 'http://localhost:3000')),
  );
  // Populate req.ip from X-Forwarded-For (CloudFront / API Gateway)
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.enableShutdownHooks();

  if (config.get<string>('NODE_ENV') !== 'production') {
    const swagger = new DocumentBuilder()
      .setTitle('App-Bus API')
      .setDescription('Real-Time Public Transport Tracker (Turkey)')
      .setVersion('0.0.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, swagger);
    SwaggerModule.setup('docs', app, doc);
  }

  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`api listening on :${port}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal bootstrap error', err);
  process.exit(1);
});
