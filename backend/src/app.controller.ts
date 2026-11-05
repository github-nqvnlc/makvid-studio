import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service.js';
import { CreateProjectDto } from './database/dto/create-project.dto.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiTags('System')
  @ApiOperation({ summary: 'Kiểm tra hoạt động máy chủ' })
  @ApiResponse({ status: 200, description: 'Trả về chuỗi Hello World!' })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @ApiTags('System')
  @ApiOperation({ summary: 'Lấy trạng thái hệ thống và kết nối PostgreSQL' })
  @ApiResponse({
    status: 200,
    description: 'Trả về metadata và trạng thái kết nối PostgreSQL',
  })
  @Get('api/status')
  async getStatus() {
    return this.appService.getStatus();
  }

  @ApiTags('Projects')
  @ApiOperation({ summary: 'Lấy danh sách các dự án từ PostgreSQL' })
  @ApiResponse({ status: 200, description: 'Danh sách các bản ghi dự án' })
  @Get('api/projects')
  async getProjects() {
    return this.appService.getProjects();
  }

  @ApiTags('Projects')
  @ApiOperation({ summary: 'Tạo mới dự án lưu vào PostgreSQL' })
  @ApiResponse({
    status: 201,
    description: 'Dự án mới đã được lưu thành công vào PostgreSQL',
  })
  @Post('api/projects')
  async createProject(@Body() body: CreateProjectDto) {
    return this.appService.createProject(body.title, body.description);
  }
}
