import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * P-66. Las notas generales del evaluador se escribían en la pantalla de
 * revisión y se perdían al guardar: `handleSaveReview` enviaba el puntaje de
 * cada respuesta pero nunca las notas, y no existía ningún endpoint donde
 * mandarlas. La columna `evaluatorNotes` ya estaba en la entidad TestResponse,
 * sin nada que la escribiera.
 */
export class SaveEvaluatorNotesDto {
  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto' })
  @MaxLength(5000, {
    message: 'Las notas no pueden superar los 5000 caracteres',
  })
  evaluatorNotes?: string;
}
