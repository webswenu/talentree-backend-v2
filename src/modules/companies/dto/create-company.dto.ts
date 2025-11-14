import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  name: string;

  @IsString()
  rut: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  logo?: string;

  @IsUUID()
  userId: string;
}
