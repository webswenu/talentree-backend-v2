import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  IsUUID,
} from 'class-validator';
import { NotificationType } from '../../../common/enums/notification-type.enum';

export class CreateNotificationDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @IsUUID()
  userId: string;
}
