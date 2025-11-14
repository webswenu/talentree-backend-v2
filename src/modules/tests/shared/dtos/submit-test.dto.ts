import {
  IsArray,
  IsDate,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TestAnswerDto {
  @IsUUID()
  @IsNotEmpty()
  questionId: string;

  @IsNotEmpty()
  answer: any;

  @IsOptional()
  @IsString()
  factor?: string;

  @IsOptional()
  timeTaken?: number;
}

export class SubmitTestDto {
  @IsUUID()
  @IsNotEmpty()
  testId: string;

  @IsUUID()
  @IsNotEmpty()
  workerId: string;

  @IsUUID()
  @IsNotEmpty()
  workerProcessId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestAnswerDto)
  answers: TestAnswerDto[];

  @IsDate()
  @Type(() => Date)
  startedAt: Date;

  @IsDate()
  @Type(() => Date)
  completedAt: Date;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
