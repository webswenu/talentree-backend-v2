import { IsUUID, IsNotEmpty } from 'class-validator';

export class SubmitAnswerDto {
  @IsUUID()
  questionId: string;

  @IsNotEmpty()
  answer: any;
}
