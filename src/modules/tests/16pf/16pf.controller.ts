import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '../../../common/enums/user-role.enum';
import { SixteenPfService } from './16pf.service';
import { SubmitTestDto } from '../shared/dtos';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('tests/16pf')
@UseGuards(JwtAuthGuard)
export class SixteenPfController {
  constructor(private readonly sixteenPfService: SixteenPfService) {}

  @Get()
  async getTest() {
    return this.sixteenPfService.getTest();
  }

  @Get('instructions')
  async getInstructions() {
    return this.sixteenPfService.getTestInstructions();
  }

  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.WORKER, UserRole.ADMIN_TALENTREE)
  async submitTest(@Body() submitDto: SubmitTestDto) {
    return this.sixteenPfService.submitTest(submitDto);
  }
}
