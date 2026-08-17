import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  Query,
  Request,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  UsePipes,
} from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN_TALENTREE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // El listado completo de usuarios es solo para Talentree.
  // El evaluador se sacó a proposito: no necesita la nomina del sistema para
  // trabajar, y con ella veia tambien a los administradores y a las empresas.
  @Get()
  @Roles(UserRole.ADMIN_TALENTREE)
  findAll(@Query() filters: UserFilterDto) {
    return this.usersService.findAll(filters);
  }

  @Patch('change-password')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY,
    UserRole.EVALUATOR,
    UserRole.WORKER,
    UserRole.GUEST,
  )
  @HttpCode(HttpStatus.OK)
  changePassword(@Request() req, @Body() changePasswordDto: ChangePasswordDto) {
    const userId = req.user.id;
    return this.usersService.changePassword(userId, changePasswordDto);
  }

  @Patch('notification-preferences')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY,
    UserRole.EVALUATOR,
    UserRole.WORKER,
    UserRole.GUEST,
  )
  @HttpCode(HttpStatus.OK)
  updateNotificationPreferences(
    @Request() req,
  ) {
    const userId = req.user.id;
    
    // El ValidationPipe elimina campos con valor false
    // Usar req.body directamente que tiene los datos antes del ValidationPipe
    // El body ya viene parseado por Express pero antes del ValidationPipe de NestJS
    const bodyData = req.body || {};
    
    // Log para debugging
    console.log('🔍 [Controller] req.body completo:', JSON.stringify(bodyData, null, 2));
    console.log('🔍 [Controller] req.body keys:', Object.keys(bodyData));
    
    // Validar manualmente los campos esperados
    const preferences: UpdateNotificationPreferencesDto = {};
    if ('emailNotifications' in bodyData) {
      preferences.emailNotifications = Boolean(bodyData.emailNotifications);
    }
    if ('newProcesses' in bodyData) {
      preferences.newProcesses = Boolean(bodyData.newProcesses);
    }
    if ('applicationUpdates' in bodyData) {
      preferences.applicationUpdates = Boolean(bodyData.applicationUpdates);
    }
    if ('testReminders' in bodyData) {
      preferences.testReminders = Boolean(bodyData.testReminders);
    }
    if ('newEvaluations' in bodyData) {
      preferences.newEvaluations = Boolean(bodyData.newEvaluations);
    }
    if ('candidateUpdates' in bodyData) {
      preferences.candidateUpdates = Boolean(bodyData.candidateUpdates);
    }
    if ('processReminders' in bodyData) {
      preferences.processReminders = Boolean(bodyData.processReminders);
    }
    
    console.log('🔍 [Controller] Preferences construidas:', JSON.stringify(preferences, null, 2));
    
    return this.usersService.updateNotificationPreferences(userId, preferences);
  }

  @Patch(':id/reset-password')
  @Roles(UserRole.ADMIN_TALENTREE)
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Param('id') userId: string,
    @Body() resetPasswordDto: ResetPasswordDto,
  ) {
    return this.usersService.resetPassword(userId, resetPasswordDto);
  }

  // Perfil propio: no recibe :id, asi que no hay forma de apuntar a otro usuario.
  // Va declarado ANTES de @Patch(':id') porque en Nest manda el orden: si
  // estuviera despues, 'me' entraria como si fuera un identificador.
  @Patch('me')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY,
    UserRole.EVALUATOR,
    UserRole.WORKER,
    UserRole.GUEST,
  )
  updateOwnProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(
      req.user.id,
      this.stripPrivilegedFields(updateUserDto),
    );
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY,
    UserRole.EVALUATOR,
    UserRole.WORKER,
    UserRole.GUEST,
  )
  findOne(@Request() req, @Param('id') id: string) {
    this.assertCanActOnUser(req, id);
    // Retornar usuario con relaciones cargadas para mantener consistencia
    return this.usersService.findOneWithRelations(id);
  }

  @Patch(':id')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY,
    UserRole.EVALUATOR,
    UserRole.WORKER,
    UserRole.GUEST,
  )
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const isAdmin = req.user?.role === UserRole.ADMIN_TALENTREE;
    this.assertCanActOnUser(req, id);

    // Un usuario puede editar su propia ficha, pero no ascenderse de rol ni
    // reactivarse solo. Esos dos campos quedan reservados al administrador.
    const payload = isAdmin
      ? updateUserDto
      : this.stripPrivilegedFields(updateUserDto);

    return this.usersService.update(id, payload, req.user?.id);
  }

  /**
   * El rol por si solo no alcanza: hay que comprobar la pertenencia.
   * Cualquier rol puede operar sobre SU ficha; solo Talentree sobre las ajenas.
   */
  private assertCanActOnUser(req: any, targetId: string): void {
    if (req.user?.role === UserRole.ADMIN_TALENTREE) return;
    if (req.user?.id === targetId) return;
    throw new ForbiddenException(
      'No tienes permiso para acceder a la ficha de otro usuario.',
    );
  }

  private stripPrivilegedFields(dto: UpdateUserDto): UpdateUserDto {
    const { role, isActive, ...rest } = dto as UpdateUserDto & {
      role?: unknown;
      isActive?: unknown;
    };
    return rest as UpdateUserDto;
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN_TALENTREE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/avatar')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY,
    UserRole.EVALUATOR,
    UserRole.WORKER,
    UserRole.GUEST,
  )
  @UseInterceptors(FileInterceptor('avatar'))
  @HttpCode(HttpStatus.OK)
  async uploadAvatar(
    @Request() req,
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }), // 2MB
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|gif|webp)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    this.assertCanActOnUser(req, id);
    return this.usersService.uploadAvatar(id, file);
  }

  @Delete(':id/avatar')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY,
    UserRole.EVALUATOR,
    UserRole.WORKER,
    UserRole.GUEST,
  )
  @HttpCode(HttpStatus.OK)
  async deleteAvatar(@Request() req, @Param('id') id: string) {
    this.assertCanActOnUser(req, id);
    return this.usersService.deleteAvatar(id);
  }
}
