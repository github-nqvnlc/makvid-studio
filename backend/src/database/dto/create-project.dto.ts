import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({
    example: 'Xây dựng module Video AI',
    description: 'Tiêu đề của dự án',
  })
  title: string;

  @ApiPropertyOptional({
    example: 'Tích hợp mô hình AI sinh video tự động',
    description: 'Mô tả chi tiết dự án',
  })
  description?: string;
}

