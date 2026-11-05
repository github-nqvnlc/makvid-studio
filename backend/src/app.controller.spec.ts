import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ProjectEntity } from './database/entities/project.entity.js';

describe('AppController', () => {
  let appController: AppController;

  const mockProjectRepo = {
    count: vi.fn().mockResolvedValue(1),
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    save: vi.fn(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: getRepositoryToken(ProjectEntity),
          useValue: mockProjectRepo,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
