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

  @Get()
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  findAll() {
    return this.usersService.findAll();
  }

  @Patch('change-password')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY, UserRole.GUEST,
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
    UserRole.COMPANY, UserRole.GUEST,
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

  @Get(':id')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY, UserRole.GUEST,
    UserRole.EVALUATOR,
    UserRole.WORKER,
    UserRole.GUEST,
  )
  findOne(@Param('id') id: string) {
    // Retornar usuario con relaciones cargadas para mantener consistencia
    return this.usersService.findOneWithRelations(id);
  }

  @Patch(':id')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY, UserRole.GUEST,
    UserRole.EVALUATOR,
    UserRole.WORKER,
    UserRole.GUEST,
  )
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
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
  async deleteAvatar(@Param('id') id: string) {
    return this.usersService.deleteAvatar(id);
  }
}
