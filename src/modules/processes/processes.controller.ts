import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
  Query,
  Put,
} from '@nestjs/common';
import { ProcessesService } from './processes.service';
import { ProcessVideoRequirementsService } from './process-video-requirements.service';
import { CreateProcessDto } from './dto/create-process.dto';
import {
  UpdateProcessDto,
  AssignEvaluatorsDto,
} from './dto/update-process.dto';
import { ProcessFilterDto } from './dto/process-filter.dto';
import {
  CreateProcessVideoRequirementDto,
  UpdateProcessVideoRequirementDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('processes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProcessesController {
  constructor(
    private readonly processesService: ProcessesService,
    private readonly processVideoRequirementsService: ProcessVideoRequirementsService,
  ) {}

  @Get('available')
  @Public()
  findPublicProcesses(@Query() filters: ProcessFilterDto) {
    return this.processesService.findPublicProcesses(filters);
  }

  @Post()
  @Roles(UserRole.ADMIN_TALENTREE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createProcessDto: CreateProcessDto, @Request() req) {
    return this.processesService.create(createProcessDto, req.user.id);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  getStats() {
    return this.processesService.getStats();
  }

  @Get()
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY,
    UserRole.EVALUATOR,
    UserRole.WORKER,
    UserRole.GUEST,
  )
  findAll(@Query() filters: ProcessFilterDto) {
    return this.processesService.findAll(filters);
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY,
    UserRole.EVALUATOR,
    UserRole.WORKER,
    UserRole.GUEST,
  )
  findOne(@Param('id') id: string) {
    return this.processesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN_TALENTREE)
  update(@Param('id') id: string, @Body() updateProcessDto: UpdateProcessDto) {
    return this.processesService.update(id, updateProcessDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN_TALENTREE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.processesService.remove(id);
  }

  @Post(':id/evaluators')
  @Roles(UserRole.ADMIN_TALENTREE)
  assignEvaluators(
    @Param('id') id: string,
    @Body() assignEvaluatorsDto: AssignEvaluatorsDto,
  ) {
    return this.processesService.assignEvaluators(id, assignEvaluatorsDto);
  }

  @Get(':id/evaluators')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY,
    UserRole.EVALUATOR,
    UserRole.GUEST,
  )
  getEvaluators(@Param('id') id: string) {
    return this.processesService.getEvaluators(id);
  }

  @Get(':id/tests')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY,
    UserRole.EVALUATOR,
    UserRole.WORKER,
    UserRole.GUEST,
  )
  getTests(@Param('id') id: string) {
    return this.processesService.getTests(id);
  }

  @Post(':id/tests/:testId')
  @Roles(UserRole.ADMIN_TALENTREE)
  addTest(@Param('id') id: string, @Param('testId') testId: string) {
    return this.processesService.addTest(id, testId);
  }

  @Delete(':id/tests/:testId')
  @Roles(UserRole.ADMIN_TALENTREE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTest(@Param('id') id: string, @Param('testId') testId: string) {
    return this.processesService.removeTest(id, testId);
  }

  @Post(':id/fixed-tests/:fixedTestId')
  @Roles(UserRole.ADMIN_TALENTREE)
  addFixedTest(
    @Param('id') id: string,
    @Param('fixedTestId') fixedTestId: string,
  ) {
    return this.processesService.addFixedTest(id, fixedTestId);
  }

  @Delete(':id/fixed-tests/:fixedTestId')
  @Roles(UserRole.ADMIN_TALENTREE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeFixedTest(
    @Param('id') id: string,
    @Param('fixedTestId') fixedTestId: string,
  ) {
    return this.processesService.removeFixedTest(id, fixedTestId);
  }

  // Video Requirements Endpoints

  @Post(':id/video-requirements')
  @Roles(UserRole.ADMIN_TALENTREE)
  @HttpCode(HttpStatus.CREATED)
  createVideoRequirement(
    @Param('id') id: string,
    @Body() createDto: CreateProcessVideoRequirementDto,
  ) {
    return this.processVideoRequirementsService.create(id, createDto);
  }

  @Get(':id/video-requirements')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY,
    UserRole.EVALUATOR,
    UserRole.WORKER,
    UserRole.GUEST,
  )
  getVideoRequirement(@Param('id') id: string) {
    return this.processVideoRequirementsService.findByProcess(id);
  }

  @Put(':id/video-requirements')
  @Roles(UserRole.ADMIN_TALENTREE)
  updateVideoRequirement(
    @Param('id') id: string,
    @Body() updateDto: UpdateProcessVideoRequirementDto,
  ) {
    return this.processVideoRequirementsService.update(id, updateDto);
  }

  @Delete(':id/video-requirements')
  @Roles(UserRole.ADMIN_TALENTREE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteVideoRequirement(@Param('id') id: string) {
    return this.processVideoRequirementsService.delete(id);
  }
}
