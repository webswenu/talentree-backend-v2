import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  Request,
} from '@nestjs/common';
import { ProcessInvitationsService } from './process-invitations.service';
import {
  CreateProcessInvitationDto,
  BulkInviteWorkersDto,
  AcceptProcessInvitationDto,
  QueryProcessInvitationsDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';

@Controller('process-invitations')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
export class ProcessInvitationsController {
  constructor(
    private readonly processInvitationsService: ProcessInvitationsService,
  ) {}

  /**
   * Crea una invitación individual
   * Solo ADMIN_TALENTREE y COMPANY pueden crear invitaciones
   */
  @Post()
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY)
  create(@Body() createDto: CreateProcessInvitationDto, @Request() req) {
    return this.processInvitationsService.create(createDto, req.user.id);
  }

  /**
   * Crea invitaciones en masa
   * Solo ADMIN_TALENTREE y COMPANY pueden crear invitaciones
   */
  @Post('bulk')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY)
  bulkCreate(@Body() bulkDto: BulkInviteWorkersDto, @Request() req) {
    return this.processInvitationsService.bulkCreate(bulkDto, req.user.id);
  }

  /**
   * Acepta una invitación (endpoint público pero con auth opcional)
   * Si el usuario está autenticado, se pasa su ID
   * Gracias a la modificación del JwtAuthGuard, req.user estará disponible si hay token
   */
  @Post('accept')
  @Public()
  async accept(@Body() acceptDto: AcceptProcessInvitationDto, @Request() req) {
    // Si hay usuario autenticado, req.user.id estará disponible
    const userId = req.user?.id;
    return this.processInvitationsService.accept(acceptDto, userId);
  }

  /**
   * Lista todas las invitaciones con filtros
   * Solo ADMIN_TALENTREE y COMPANY pueden ver las invitaciones
   */
  @Get()
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY)
  findAll(@Query() queryDto: QueryProcessInvitationsDto) {
    return this.processInvitationsService.findAll(queryDto);
  }

  /**
   * Obtiene una invitación por token (endpoint público)
   * Usado para validar invitaciones antes de aceptar
   */
  @Get('by-token/:token')
  @Public()
  findByToken(@Param('token') token: string) {
    return this.processInvitationsService.findByToken(token);
  }

  /**
   * Obtiene las invitaciones pendientes del trabajador logueado
   * Solo WORKER puede acceder
   */
  @Get('my-invitations')
  @Roles(UserRole.WORKER)
  findMyInvitations(@Request() req) {
    return this.processInvitationsService.findByEmail(req.user.email);
  }

  /**
   * Obtiene una invitación por ID
   * Solo ADMIN_TALENTREE y COMPANY pueden ver detalles
   */
  @Get(':id')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY)
  findOne(@Param('id') id: string) {
    return this.processInvitationsService.findOne(id);
  }

  /**
   * Cancela una invitación
   * Solo ADMIN_TALENTREE y COMPANY pueden cancelar
   */
  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY)
  cancel(@Param('id') id: string) {
    return this.processInvitationsService.cancel(id);
  }

  /**
   * Reenvía una invitación
   * Solo ADMIN_TALENTREE y COMPANY pueden reenviar
   */
  @Patch(':id/resend')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY)
  resend(@Param('id') id: string) {
    return this.processInvitationsService.resend(id);
  }
}
