import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ProcessInvitationStatus } from '../entities/process-invitation.entity';

export class QueryProcessInvitationsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  processId?: string;

  @IsOptional()
  @IsEnum(ProcessInvitationStatus)
  status?: ProcessInvitationStatus;

  @IsOptional()
  search?: string;
}
