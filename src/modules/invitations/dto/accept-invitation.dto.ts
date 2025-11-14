import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password: string;
}
