import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { validateSecrets } from './config/validate-secrets';

async function bootstrap() {
  // Fail fast on insecure defaults in production
  validateSecrets();

  const app = await NestFactory.create(AppModule);

  // Public health-check (registered before all middleware so NestJS filters don't intercept it)
  app.use('/health', (_req: any, res: any) => res.status(200).json({ ok: true }));

  // Security headers — relax CORP/COOP in non-production so cross-origin Angular dev servers
  // can read API responses without browser-level blocking.
  const isDev = process.env.NODE_ENV !== 'production';
  app.use(
    helmet({
      crossOriginResourcePolicy: isDev ? false : { policy: 'same-origin' },
      crossOriginOpenerPolicy: isDev ? false : { policy: 'same-origin' },
    }),
  );

  // Cookie parsing (for HTTP-only JWT cookies)
  app.use(cookieParser());

  // CORS — restrict to Angular app origins in production
  app.enableCors({
    origin: [
      process.env.CLIENT_APP_URL ?? 'http://localhost:4200',
      process.env.ADMIN_APP_URL ?? 'http://localhost:4201',
    ],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,Accept,X-Requested-With',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Global API prefix
  app.setGlobalPrefix('api/v1');

  // Global validation pipe — strip unknown properties, transform types
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global response envelope + error filter
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Swagger — only in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Travel Agency B2B API')
      .setDescription('B2B hotel booking platform API for travel agencies')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'access-token',
      )
      .addTag('auth', 'Authentication & account management')
      .addTag('hotels', 'Hotel search, details & prebook')
      .addTag('bookings', 'Booking lifecycle (create, cancel, voucher)')
      .addTag('payments', 'Online payment sessions & webhook')
      .addTag('wallet', 'Wallet top-up & transaction history')
      .addTag('companies', 'Company profile & credit management')
      .addTag('admin', 'Admin operations (approval, suspend, reports)')
      .addTag('cms', 'CMS pages & email templates')
      .addTag('support', 'Support ticket management')
      .addTag('notifications', 'In-app notifications')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    console.log('Swagger UI available at http://localhost:3000/api/docs');

    // Export OpenAPI spec to docs/ on startup (dev/CI only)
    if (process.env.EXPORT_OPENAPI === 'true') {
      const docsDir = join(__dirname, '..', '..', 'docs');
      const specPath = join(docsDir, 'openapi.json');
      writeFileSync(specPath, JSON.stringify(document, null, 2));
      console.log(`[OpenAPI] Spec written to ${specPath}`);
      await app.close();
      process.exit(0);
    }
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}/api/v1`);
}

bootstrap();
