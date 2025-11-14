import { DataSource } from 'typeorm';
import { FixedTest } from '../../modules/tests/entities/fixed-test.entity';
import { FixedTestQuestion } from '../../modules/tests/entities/fixed-test-question.entity';
import { FixedTestCode, TestQuestionType } from '../../modules/tests/shared/enums';

export class SixteenPfSeeder {
  /**
   * Tabla normativa para el test 16PF
   */
  private static getNormativeTable() {
    return [
      { factor: 'A', mean: 5.5, stdDev: 2, description: 'Calidez' },
      { factor: 'B', mean: 5.5, stdDev: 2, description: 'Razonamiento' },
      { factor: 'C', mean: 5.5, stdDev: 2, description: 'Estabilidad emocional' },
      { factor: 'E', mean: 5.5, stdDev: 2, description: 'Dominancia' },
      { factor: 'F', mean: 5.5, stdDev: 2, description: 'Vivacidad' },
      { factor: 'G', mean: 5.5, stdDev: 2, description: 'Conciencia de normas' },
      { factor: 'H', mean: 5.5, stdDev: 2, description: 'Atrevimiento social' },
      { factor: 'I', mean: 5.5, stdDev: 2, description: 'Sensibilidad' },
      { factor: 'L', mean: 5.5, stdDev: 2, description: 'Vigilancia' },
      { factor: 'M', mean: 5.5, stdDev: 2, description: 'Imaginación' },
      { factor: 'N', mean: 5.5, stdDev: 2, description: 'Privacidad' },
      { factor: 'O', mean: 5.5, stdDev: 2, description: 'Aprensión' },
      { factor: 'Q1', mean: 5.5, stdDev: 2, description: 'Apertura al cambio' },
      { factor: 'Q2', mean: 5.5, stdDev: 2, description: 'Autosuficiencia' },
      { factor: 'Q3', mean: 5.5, stdDev: 2, description: 'Perfeccionismo' },
      { factor: 'Q4', mean: 5.5, stdDev: 2, description: 'Tensión' },
    ];
  }

  /**
   * Preguntas del test 16PF
   * Cargadas desde el archivo JSON generado a partir del Excel
   */
  private static getQuestions() {
    return require('./data/16pf-questions.json');
  }

  public static async run(dataSource: DataSource): Promise<void> {
    console.log('🌱 Seeding 16PF test...');

    const fixedTestRepository = dataSource.getRepository(FixedTest);
    const fixedTestQuestionRepository = dataSource.getRepository(FixedTestQuestion);

    // Verificar si ya existe
    const existing = await fixedTestRepository.findOne({
      where: { code: FixedTestCode.TEST_16PF },
    });

    if (existing) {
      console.log('⚠️  16PF test already exists. Skipping...');
      return;
    }

    // Crear el test con su configuración
    const test = fixedTestRepository.create({
      code: FixedTestCode.TEST_16PF,
      name: 'Test de Personalidad 16 PF',
      description:
        'Cuestionario Factorial de Personalidad de 16 factores de Raymond Cattell. Evalúa 16 dimensiones fundamentales de la personalidad.',
      duration: 45, // 45 minutos
      isActive: true,
      orderIndex: 1,
      configuration: {
        normativeTable: this.getNormativeTable(),
        scoringMethod: 'decatipo',
        instructions: [
          'Este cuestionario no tiene respuestas buenas ni malas, simplemente reflejan su forma de ser.',
          'Contesta todas las preguntas, eligiendo la alternativa A, B o C según corresponda.',
          'No piense demasiado las respuestas, responda con sinceridad y rapidez.',
          'Tiene 45 minutos para completar el test.',
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
        questionType: TestQuestionType.MULTIPLE_CHOICE_TERNARY,
        factor: q.factor,
        options: q.options,
        correctAnswer: null, // No hay respuesta correcta en tests de personalidad
        points: 1,
        metadata: q.metadata,
      }),
    );

    // Guardar en lotes de 50 para mejorar el rendimiento
    const batchSize = 50;
    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);
      await fixedTestQuestionRepository.save(batch);
      console.log(`   Saved questions ${i + 1} - ${Math.min(i + batchSize, questions.length)}`);
    }

    console.log(`✅ 16PF test seeded successfully with ${questions.length} questions`);
  }
}
