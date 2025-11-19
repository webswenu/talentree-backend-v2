import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InviteeDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;
}

export class BulkInviteWorkersDto {
  @IsUUID()
  @IsNotEmpty()
  processId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InviteeDto)
  invitees: InviteeDto[];
}
