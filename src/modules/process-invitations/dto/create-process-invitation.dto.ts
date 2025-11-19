import { IsEmail, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateProcessInvitationDto {
  @IsUUID()
  @IsNotEmpty()
  processId: string;

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
