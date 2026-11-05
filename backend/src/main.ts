import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? ['http://localhost:3002', 'http://localhost:3000'],
    credentials: true,
  });

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('Makvid Studio Platform API')
    .setDescription('Tài liệu API hệ thống Makvid Studio (NestJS + PostgreSQL)')
    .setVersion('1.0')
    .addTag('System', 'Endpoints kiểm tra hệ thống và trạng thái kết nối DB')
    .addTag('Projects', 'Endpoints quản trị dữ liệu dự án lưu tại PostgreSQL')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Makvid Studio API Docs',
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`🚀 Backend is running on: http://localhost:${port}`);
  console.log(`📚 Swagger Docs available at: http://localhost:${port}/api/docs`);
}
await bootstrap();
