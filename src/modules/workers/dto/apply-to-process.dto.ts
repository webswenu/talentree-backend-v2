import { IsUUID, IsOptional, IsString } from 'class-validator';

export class ApplyToProcessDto {
  @IsUUID()
  workerId: string;

  @IsUUID()
  processId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
