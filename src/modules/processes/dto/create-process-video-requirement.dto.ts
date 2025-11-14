import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class VideoQuestionDto {
  @IsInt()
  @Min(1)
  order: number;

  @IsString()
  question: string;

  @IsInt()
  @Min(0)
  displayAtSecond: number;
}

export class CreateProcessVideoRequirementDto {
  @IsBoolean()
  isRequired: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxDuration?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VideoQuestionDto)
  questions?: VideoQuestionDto[];

  @IsOptional()
  @IsString()
  instructions?: string;
}
