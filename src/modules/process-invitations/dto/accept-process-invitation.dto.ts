import { IsNotEmpty, IsString } from 'class-validator';

export class AcceptProcessInvitationDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
