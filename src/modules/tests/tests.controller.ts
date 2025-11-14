import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TestsService } from './tests.service';
import { CreateTestDto } from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('tests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  @Post()
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.GUEST)
  create(@Body() createTestDto: CreateTestDto, @Request() req) {
    return this.testsService.create(createTestDto, req.user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  findAll() {
    return this.testsService.findAll();
  }

  @Get('fixed')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  findAllFixed() {
    return this.testsService.findAllFixedTests();
  }

  @Get('fixed/:id')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  findOneFixed(@Param('id') id: string) {
    return this.testsService.findOneFixedTest(id);
  }

  @Get('type/:type')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  findByType(@Param('type') type: string) {
    return this.testsService.findByType(type);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  findOne(@Param('id') id: string) {
    return this.testsService.findOne(id);
  }

  @Get(':id/questions')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY, UserRole.GUEST,
    UserRole.EVALUATOR,
    UserRole.WORKER,
  )
  getQuestions(@Param('id') id: string) {
    return this.testsService.getQuestions(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.GUEST)
  update(@Param('id') id: string, @Body() updateTestDto: UpdateTestDto) {
    return this.testsService.update(id, updateTestDto);
  }

  @Patch(':id/toggle-active')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.GUEST)
  toggleActive(@Param('id') id: string) {
    return this.testsService.toggleActive(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN_TALENTREE)
  remove(@Param('id') id: string) {
    return this.testsService.remove(id);
  }
}
