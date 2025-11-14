import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  newProcesses?: boolean;

  @IsOptional()
  @IsBoolean()
  applicationUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  testReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  newEvaluations?: boolean;

  @IsOptional()
  @IsBoolean()
  candidateUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  processReminders?: boolean;
}
