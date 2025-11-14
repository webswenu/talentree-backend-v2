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
import { IcService } from './ic.service';
import { SubmitTestDto } from '../shared/dtos';

@Controller('tests/ic')
@UseGuards(JwtAuthGuard)
export class IcController {
  constructor(private readonly icService: IcService) {}

  @Get()
  async getTest() {
    return this.icService.getTest();
  }

  @Get('instructions')
  async getInstructions() {
    return this.icService.getTestInstructions();
  }

  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.WORKER, UserRole.ADMIN_TALENTREE)
  async submitTest(@Body() submitDto: SubmitTestDto) {
    return this.icService.submitTest(submitDto);
  }
}
