import { IsInt, IsBoolean, IsOptional, IsString, Min } from 'class-validator';

export class EvaluateAnswerDto {
  @IsInt()
  @Min(0)
  score: number;

  @IsBoolean()
  isCorrect: boolean;

  @IsOptional()
  @IsString()
  evaluatorComment?: string;
}
