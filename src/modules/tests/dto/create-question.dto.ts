import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsInt,
  IsBoolean,
  Min,
} from 'class-validator';
import { QuestionType } from '../../../common/enums/question-type.enum';

export class CreateQuestionDto {
  @IsString()
  question: string;

  @IsEnum(QuestionType)
  type: QuestionType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  correctAnswers?: string[];

  @IsInt()
  @Min(1)
  points: number;

  @IsInt()
  @Min(1)
  order: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}
