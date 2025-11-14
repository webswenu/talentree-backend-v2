import { IsUUID, IsBoolean, IsOptional } from 'class-validator';

export class StartTestDto {
  @IsUUID()
  testId: string;

  @IsUUID()
  workerProcessId: string;

  @IsBoolean()
  @IsOptional()
  isFixedTest?: boolean;
}
