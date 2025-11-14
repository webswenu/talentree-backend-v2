import { IsString, IsOptional, IsBoolean, IsDefined } from 'class-validator';

export class UpdateSettingDto {
  @IsString()
  key: string;

  @IsDefined()
  value: any;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
