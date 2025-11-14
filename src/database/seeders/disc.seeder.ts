import { DataSource } from 'typeorm';
import { FixedTest } from '../../modules/tests/entities/fixed-test.entity';
import { FixedTestQuestion } from '../../modules/tests/entities/fixed-test-question.entity';
import { FixedTestCode, TestQuestionType } from '../../modules/tests/shared/enums';

export class DiscSeeder {
  /**
   * Preguntas del test DISC
   * Cargadas desde el archivo JSON generado a partir del Excel
   */
  private static getQuestions() {
    return require('./data/disc-questions.json');
  }

  public static async run(dataSource: DataSource): Promise<void> {
    console.log('🌱 Seeding DISC test...');

    const fixedTestRepository = dataSource.getRepository(FixedTest);
    const fixedTestQuestionRepository = dataSource.getRepository(FixedTestQuestion);

    // Verificar si ya existe
    const existing = await fixedTestRepository.findOne({
      where: { code: FixedTestCode.TEST_DISC },
    });

    if (existing) {
      console.log('⚠️  DISC test already exists. Skipping...');
      return;
    }

    // Crear el test con su configuración
    const test = fixedTestRepository.create({
      code: FixedTestCode.TEST_DISC,
      name: 'Test DISC de Personalidad',
      description:
        'Evaluación de perfil conductual basada en 4 dimensiones: Dominancia, Influencia, Estabilidad y Cumplimiento. Utiliza metodología de elección forzada para determinar el estilo de comportamiento predominante.',
      duration: 15, // 15 minutos
      isActive: true,
      orderIndex: 2,
      configuration: {
        dimensions: [
          { code: 'D', name: 'Dominancia', description: 'Enfocado en resultados, decidido, directo' },
          { code: 'I', name: 'Influencia', description: 'Comunicativo, persuasivo, entusiasta' },
          { code: 'S', name: 'Estabilidad', description: 'Paciente, cooperativo, constante' },
          { code: 'C', name: 'Cumplimiento', description: 'Detallista, analítico, meticuloso' },
        ],
        scoringMethod: 'algebraic_sum',
        instructions: [
          'Este test consta de 24 bloques, cada uno con 4 palabras.',
          'Para cada bloque:',
          '  • Seleccione UNA palabra que MÁS lo describe',
          '  • Seleccione UNA palabra que MENOS lo describe',
          'No hay respuestas correctas o incorrectas.',
          'Responda de forma honesta y rápida.',
          `Tiene ${15} minutos para completar el test.`,
        ],
      },
    });

    const savedTest = await fixedTestRepository.save(test);
    console.log(`✅ Created test: ${savedTest.name}`);

    // Cargar las preguntas
    const questionsData = this.getQuestions();
    console.log(`📝 Loading ${questionsData.length} question blocks...`);

    const questions = questionsData.map((q: any) =>
      fixedTestQuestionRepository.create({
        fixedTestId: savedTest.id,
        questionNumber: q.questionNumber,
        questionText: q.questionText,
        questionType: TestQuestionType.FORCED_CHOICE,
        factor: null, // No aplica para DISC, todas las dimensiones están en las opciones
        options: q.options,
        correctAnswer: null, // No hay respuesta correcta en tests de personalidad
        points: 1,
        metadata: q.metadata,
      }),
    );

    await fixedTestQuestionRepository.save(questions);
    console.log(`✅ DISC test seeded successfully with ${questions.length} question blocks`);
  }
}
