import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ProjectEntity } from './database/entities/project.entity.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get<number>('DB_PORT', 5432)),
        username: config.get<string>('DB_USERNAME', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgrespassword'),
        database: config.get<string>('DB_NAME', 'makvid_studio_db'),
        entities: [ProjectEntity],
        synchronize:
          config.get<string>('DB_SYNCHRONIZE', 'true') === 'true',
        autoLoadEntities: true,
      }),
    }),
    TypeOrmModule.forFeature([ProjectEntity]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
