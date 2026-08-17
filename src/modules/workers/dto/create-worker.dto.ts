import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  IsArray,
  MinLength,
} from 'class-validator';
import { IsRut, NormalizeRut } from '../../../common/validators/rut.validator';
import { IsStrongPassword } from '../../../common/validators/password.validator';

export class CreateWorkerDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  // P-51 / ADM-TRA-04: el alta desde el panel no validaba el RUT en absoluto.
  @IsString({ message: 'El RUT es obligatorio' })
  @IsRut()
  @NormalizeRut()
  rut: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @IsStrongPassword()
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
