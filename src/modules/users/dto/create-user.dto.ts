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
import {
  IsTelefono,
  NormalizeTelefono,
} from '../../../common/validators/telefono.validator';
import { UserRole } from '../../../common/enums/user-role.enum';

export class CreateUserDto {
  @IsEmail({}, { message: 'El email ingresado no es válido' })
  email: string;

  // P-52: la politica de contrasena vale para todas las vias de alta.
  @IsString()
  @IsStrongPassword()
  password: string;

  @IsString({ message: 'El nombre es obligatorio' })
  firstName: string;

  @IsString({ message: 'El apellido es obligatorio' })
  lastName: string;

  // R-10. Es la via por la que el propio candidato edita su telefono desde el
  // perfil: sin regla aqui, la del registro solo duraba hasta el primer cambio.
  @IsOptional()
  @NormalizeTelefono()
  @IsTelefono()
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
