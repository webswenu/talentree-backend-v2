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
import { UserRole } from 'src/common/enums/user-role.enum';
import { WonderlicService } from './wonderlic.service';
import { SubmitTestDto } from '../shared/dtos';

@Controller('tests/wonderlic')
@UseGuards(JwtAuthGuard)
export class WonderlicController {
  constructor(private readonly wonderlicService: WonderlicService) {}

  @Get()
  async getTest() {
    return this.wonderlicService.getTest();
  }

  @Get('instructions')
  async getInstructions() {
    return this.wonderlicService.getTestInstructions();
  }

  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.WORKER, UserRole.ADMIN_TALENTREE)
  async submitTest(@Body() submitDto: SubmitTestDto) {
    return this.wonderlicService.submitTest(submitDto);
  }
}
