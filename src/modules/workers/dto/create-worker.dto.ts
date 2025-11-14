import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  IsArray,
  MinLength,
} from 'class-validator';

export class CreateWorkerDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  rut: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  education?: string;

  @IsOptional()
  @IsString()
  experience?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsString()
  cvUrl?: string;
}
