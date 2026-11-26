import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TestResponsesService } from './test-responses.service';
import { StartTestDto } from './dto/start-test.dto';
import { SubmitTestDto } from './dto/submit-test.dto';
import { EvaluateAnswerDto } from './dto/evaluate-answer.dto';
import { SaveEvaluatorNotesDto } from './dto/save-evaluator-notes.dto';
import { ReactivarTestDto } from './dto/reactivar-test.dto';
import { ReiniciarParticipacionDto } from './dto/reiniciar-participacion.dto';
import { ReiniciarTestDto } from './dto/reiniciar-test.dto';
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
  startTest(@Body() startTestDto: StartTestDto, @Request() req: any) {
    return this.testResponsesService.startTest(startTestDto, req.user);
  }

  @Post(':id/submit')
  @Roles(UserRole.WORKER, UserRole.ADMIN_TALENTREE, UserRole.COMPANY)
  submitTest(@Param('id') id: string, @Body() submitTestDto: SubmitTestDto, @Request() req: any) {
    return this.testResponsesService.submitTest(id, submitTestDto, req.user);
  }

  /** El admin reabre un test incompleto y, si quiere, avisa por correo. */
  @Post(':id/reactivar')
  @Roles(UserRole.ADMIN_TALENTREE)
  reactivar(@Param('id') id: string, @Body() dto: ReactivarTestDto) {
    return this.testResponsesService.reactivarTest(id, dto);
  }

  /**
   * Solo el admin de Talentree: borra todos los tests de la postulación para
   * que la persona los rinda de nuevo. El trabajador no puede hacerlo.
   */
  @Post('worker-process/:workerProcessId/reiniciar')
  @Roles(UserRole.ADMIN_TALENTREE)
  reiniciarParticipacion(
    @Param('workerProcessId', new ParseUUIDPipe()) workerProcessId: string,
    @Body() dto: ReiniciarParticipacionDto,
    @Request() req: any,
  ) {
    return this.testResponsesService.reiniciarParticipacion(workerProcessId, dto, req.user);
  }

  /**
   * Solo el admin de Talentree: borra UN test de la postulación (completo,
   * incompleto o abierto) para que la persona lo rinda de nuevo desde cero.
   */
  @Post(':id/reiniciar')
  @Roles(UserRole.ADMIN_TALENTREE)
  reiniciarTest(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReiniciarTestDto,
    @Request() req: any,
  ) {
    return this.testResponsesService.reiniciarTest(id, dto, req.user);
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
  findByWorkerProcess(
    @Param('workerProcessId') workerProcessId: string,
    @Request() req: any,
  ) {
    return this.testResponsesService.findByWorkerProcess(
      workerProcessId,
      req.user,
    );
  }

  @Get('test/:testId')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  findByTest(@Param('testId') testId: string) {
    return this.testResponsesService.findByTest(testId);
  }
}
