import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Delete,
  UseGuards,
  Post,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { UpdateSettingsBatchDto } from './dto/update-settings-batch.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles(UserRole.ADMIN_TALENTREE)
  findAll() {
    return this.settingsService.findAll();
  }

  @Get('public')
  findPublic() {
    return this.settingsService.findPublic();
  }

  @Get('general')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  getGeneralSettings() {
    return this.settingsService.getGeneralSettings();
  }

  @Get('notifications')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  getNotificationSettings() {
    return this.settingsService.getNotificationSettings();
  }

  @Get('initialize')
  @Roles(UserRole.ADMIN_TALENTREE)
  initializeDefaultsGet() {
    // Esta ruta es solo para evitar que :key capture 'initialize'
    // El método real está en @Post('initialize')
    return { message: 'Use POST /settings/initialize' };
  }

  @Get(':key')
  @Roles(UserRole.ADMIN_TALENTREE)
  findByKey(@Param('key') key: string) {
    return this.settingsService.findByKey(key);
  }

  @Put()
  @Roles(UserRole.ADMIN_TALENTREE)
  upsert(@Body() updateSettingDto: UpdateSettingDto) {
    return this.settingsService.upsert(updateSettingDto);
  }

  @Put('batch')
  @Roles(UserRole.ADMIN_TALENTREE)
  upsertBatch(@Body() updateSettingsBatchDto: UpdateSettingsBatchDto) {
    return this.settingsService.upsertBatch(updateSettingsBatchDto.settings);
  }

  @Delete(':key')
  @Roles(UserRole.ADMIN_TALENTREE)
  delete(@Param('key') key: string) {
    return this.settingsService.delete(key);
  }

  @Post('initialize')
  @Roles(UserRole.ADMIN_TALENTREE)
  initializeDefaults() {
    return this.settingsService.initializeDefaults();
  }
}
