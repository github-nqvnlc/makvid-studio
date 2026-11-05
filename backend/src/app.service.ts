import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity } from './database/entities/project.entity.js';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
  ) {}

  async onApplicationBootstrap() {
    try {
      const count = await this.projectRepository.count();
      if (count === 0) {
        await this.projectRepository.save([
          {
            title: 'Makvid Studio Platform Initialized',
            description:
              'PostgreSQL database container connected successfully to NestJS backend.',
            status: 'completed',
          },
        ]);
        console.log('✅ Seeded initial sample project into PostgreSQL database.');
      }
    } catch (error) {
      console.warn('⚠️ Could not check/seed database on startup:', error);
    }
  }

  getHello(): string {
    return 'Hello World!';
  }

  async getStatus() {
    let databaseStatus = 'unknown';
    let projectCount = 0;

    try {
      projectCount = await this.projectRepository.count();
      databaseStatus = 'connected';
    } catch {
      databaseStatus = 'disconnected';
    }

    return {
      status: 'ok',
      service: 'Makvid Studio Backend',
      framework: 'NestJS',
      database: {
        type: 'PostgreSQL',
        status: databaseStatus,
        projectsCount: projectCount,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getProjects() {
    return this.projectRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async createProject(title: string, description?: string) {
    const project = this.projectRepository.create({
      title,
      description,
      status: 'active',
    });
    return this.projectRepository.save(project);
  }
}
