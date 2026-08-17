import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TestResponsesService } from './test-responses.service';
import { StartTestDto } from './dto/start-test.dto';
import { SubmitTestDto } from './dto/submit-test.dto';
import { EvaluateAnswerDto } from './dto/evaluate-answer.dto';
import { SaveEvaluatorNotesDto } from './dto/save-evaluator-notes.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('test-responses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TestResponsesController {
  constructor(private readonly testResponsesService: TestResponsesService) {}

  @Get('stats')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  getStats() {
    return this.testResponsesService.getStats();
  }

  @Post('start')
  @Roles(UserRole.WORKER, UserRole.ADMIN_TALENTREE, UserRole.COMPANY)
  startTest(@Body() startTestDto: StartTestDto) {
    return this.testResponsesService.startTest(startTestDto);
  }

  @Post(':id/submit')
  @Roles(UserRole.WORKER, UserRole.ADMIN_TALENTREE, UserRole.COMPANY)
  submitTest(@Param('id') id: string, @Body() submitTestDto: SubmitTestDto, @Request() req: any) {
    return this.testResponsesService.submitTest(id, submitTestDto, req.user);
  }

  @Post(':id/auto-evaluate')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  autoEvaluate(@Param('id') id: string) {
    return this.testResponsesService.autoEvaluate(id);
  }

  @Patch('answer/:id/evaluate')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  evaluateAnswer(
    @Param('id') id: string,
    @Body() evaluateDto: EvaluateAnswerDto,
  ) {
    return this.testResponsesService.evaluateAnswer(id, evaluateDto);
  }

  /**
   * P-66: guarda las notas generales de la evaluación. No existía ningún
   * endpoint para ellas, así que lo que el evaluador escribía se perdía.
   */
  @Patch(':id/evaluator-notes')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  saveEvaluatorNotes(
    @Param('id') id: string,
    @Body() dto: SaveEvaluatorNotesDto,
  ) {
    return this.testResponsesService.saveEvaluatorNotes(id, dto);
  }

  @Post(':id/recalculate')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  recalculateScore(@Param('id') id: string) {
    return this.testResponsesService.recalculateScore(id);
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY, UserRole.GUEST,
    UserRole.EVALUATOR,
    UserRole.WORKER,
  )
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.testResponsesService.findOne(id, req.user);
  }

  @Get('worker-process/:workerProcessId')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY, UserRole.GUEST,
    UserRole.EVALUATOR,
    UserRole.WORKER,
  )
  findByWorkerProcess(@Param('workerProcessId') workerProcessId: string) {
    return this.testResponsesService.findByWorkerProcess(workerProcessId);
  }

  @Get('test/:testId')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  findByTest(@Param('testId') testId: string) {
    return this.testResponsesService.findByTest(testId);
  }
}
