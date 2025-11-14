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
import { CfrService } from './cfr.service';
import { SubmitTestDto } from '../shared/dtos';

@Controller('tests/cfr')
@UseGuards(JwtAuthGuard)
export class CfrController {
  constructor(private readonly cfrService: CfrService) {}

  @Get()
  async getTest() {
    return this.cfrService.getTest();
  }

  @Get('instructions')
  async getInstructions() {
    return this.cfrService.getTestInstructions();
  }

  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.WORKER, UserRole.ADMIN_TALENTREE)
  async submitTest(@Body() submitDto: SubmitTestDto) {
    return this.cfrService.submitTest(submitDto);
  }
}
