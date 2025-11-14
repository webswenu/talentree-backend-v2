import { DataSource } from 'typeorm';
import { FixedTest } from '../../modules/tests/entities/fixed-test.entity';
import { FixedTestQuestion } from '../../modules/tests/entities/fixed-test-question.entity';
import { FixedTestCode, TestQuestionType } from '../../modules/tests/shared/enums';

export class WonderlicSeeder {
  /**
   * Preguntas del test de Inteligencia Laboral (Wonderlic)
   * Cargadas desde el archivo JSON generado a partir del Excel
   */
  private static getQuestions() {
    return require('./data/wonderlic-questions.json');
  }

  public static async run(dataSource: DataSource): Promise<void> {
    console.log('🌱 Seeding Wonderlic (Inteligencia Laboral) test...');

    const fixedTestRepository = dataSource.getRepository(FixedTest);
    const fixedTestQuestionRepository = dataSource.getRepository(FixedTestQuestion);

    // Verificar si ya existe
    const existing = await fixedTestRepository.findOne({
      where: { code: FixedTestCode.TEST_IL },
    });

    if (existing) {
      console.log('⚠️  Wonderlic test already exists. Skipping...');
      return;
    }

    // Crear el test con su configuración
    const test = fixedTestRepository.create({
      code: FixedTestCode.TEST_IL,
      name: 'Test de Inteligencia Laboral (Wonderlic)',
      description:
        'Evaluación de razonamiento lógico, numérico y verbal. Diseñado para medir la capacidad cognitiva general y la rapidez mental en contextos laborales.',
      duration: 12, // 12 minutos (tiempo límite estándar Wonderlic)
      isActive: true,
      orderIndex: 3,
      configuration: {
        scoringMethod: 'correct_answers',
        maxScore: 20,
        interpretation: {
          bajo: { min: 0, max: 7, description: 'Dificultad para resolver problemas o seguir instrucciones complejas' },
          medio: { min: 8, max: 14, description: 'Capacidad promedio para el razonamiento y comprensión' },
          alto: { min: 15, max: 20, description: 'Alta capacidad de razonamiento y rapidez mental' },
        },
        areas: [
          'Razonamiento lógico: patrones, secuencias y relaciones',
          'Razonamiento numérico: cálculos básicos y problemas matemáticos',
          'Razonamiento verbal: comprensión de palabras y conceptos',
        ],
        instructions: [
          'Este test evalúa su capacidad de razonamiento lógico, numérico y verbal.',
          'Contiene 20 preguntas de opción múltiple (A, B, C, D).',
          'Cada pregunta tiene UNA respuesta correcta.',
          `Tiene ${12} minutos para completar el test.`,
          'Trate de responder todas las preguntas, incluso si no está completamente seguro.',
          'No se penalizan las respuestas incorrectas.',
        ],
      },
    });

    const savedTest = await fixedTestRepository.save(test);
    console.log(`✅ Created test: ${savedTest.name}`);

    // Cargar las preguntas
    const questionsData = this.getQuestions();
    console.log(`📝 Loading ${questionsData.length} questions...`);

    const questions = questionsData.map((q: any) =>
      fixedTestQuestionRepository.create({
        fixedTestId: savedTest.id,
        questionNumber: q.questionNumber,
        questionText: q.questionText,
        questionType: TestQuestionType.MULTIPLE_CHOICE,
        factor: null,
        options: q.options,
        correctAnswer: { answer: q.correctAnswer },
        points: q.points,
        metadata: {
          hasCorrectAnswer: true,
        },
      }),
    );

    await fixedTestQuestionRepository.save(questions);
    console.log(`✅ Wonderlic test seeded successfully with ${questions.length} questions`);
  }
}
