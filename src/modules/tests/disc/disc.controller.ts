import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { DiscService } from './disc.service';
import { SubmitTestDto } from '../shared/dtos';

@Controller('tests/disc')
@UseGuards(JwtAuthGuard)
export class DiscController {
  constructor(private readonly discService: DiscService) {}

  @Get()
  async getTest() {
    return this.discService.getTest();
  }

  @Get('instructions')
  async getInstructions() {
    return this.discService.getTestInstructions();
  }

  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.WORKER, UserRole.ADMIN_TALENTREE)
  async submitTest(@Body() submitDto: SubmitTestDto) {
    return this.discService.submitTest(submitDto);
  }
}
