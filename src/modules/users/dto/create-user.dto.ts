import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/password.validator';
import { UserRole } from '../../../common/enums/user-role.enum';

export class CreateUserDto {
  @IsEmail({}, { message: 'El email ingresado no es valido' })
  email: string;

  // P-52: la politica de contrasena vale para todas las vias de alta.
  @IsString()
  @IsStrongPassword()
  password: string;

  @IsString({ message: 'El nombre es obligatorio' })
  firstName: string;

  @IsString({ message: 'El apellido es obligatorio' })
  lastName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isEmailVerified?: boolean;

  @IsOptional()
  @IsUUID()
  companyId?: string;
}
