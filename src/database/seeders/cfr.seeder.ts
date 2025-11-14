import { DataSource } from 'typeorm';
import { FixedTest } from '../../modules/tests/entities/fixed-test.entity';
import { FixedTestQuestion } from '../../modules/tests/entities/fixed-test-question.entity';
import { FixedTestCode, TestQuestionType } from '../../modules/tests/shared/enums';

export class CfrSeeder {
  /**
   * Preguntas del test CFR (Conducta Frente al Riesgo)
   * Cargadas desde el archivo JSON generado a partir del Excel
   */
  private static getQuestions() {
    return require('./data/cfr-questions.json');
  }

  public static async run(dataSource: DataSource): Promise<void> {
    console.log('🌱 Seeding CFR (Conducta Frente al Riesgo) test...');

    const fixedTestRepository = dataSource.getRepository(FixedTest);
    const fixedTestQuestionRepository = dataSource.getRepository(FixedTestQuestion);

    // Verificar si ya existe
    const existing = await fixedTestRepository.findOne({
      where: { code: FixedTestCode.TEST_CFR },
    });

    if (existing) {
      console.log('⚠️  CFR test already exists. Skipping...');
      return;
    }

    // Crear el test con su configuración
    const test = fixedTestRepository.create({
      code: FixedTestCode.TEST_CFR,
      name: 'Test de Conducta Frente al Riesgo (CFR)',
      description:
        'Evaluación del nivel de propensión al riesgo mediante 60 afirmaciones sobre comportamientos arriesgados. Utiliza escala Likert (1-5) para medir la tendencia a tomar riesgos en diferentes contextos.',
      duration: 15, // 15 minutos para 60 preguntas Likert
      isActive: true,
      orderIndex: 4,
      configuration: {
        scoringMethod: 'sum',
        minScore: 60,
        maxScore: 300,
        interpretation: {
          bajo: {
            min: 60,
            max: 120,
            description: 'Baja propensión al riesgo - Persona cautelosa que evita situaciones arriesgadas'
          },
          medio: {
            min: 121,
            max: 200,
            description: 'Propensión moderada al riesgo - Equilibrio entre precaución y toma de riesgos calculados'
          },
          alto: {
            min: 201,
            max: 300,
            description: 'Alta propensión al riesgo - Persona que busca experiencias arriesgadas y desafiantes'
          },
        },
        instructions: [
          'Este test evalúa su propensión a tomar riesgos en diferentes situaciones.',
          'Contiene 60 afirmaciones sobre comportamientos y actitudes.',
          'Para cada afirmación, indique su nivel de acuerdo usando la escala:',
          '  1 = Totalmente en desacuerdo',
          '  2 = En desacuerdo',
          '  3 = Neutral',
          '  4 = De acuerdo',
          '  5 = Totalmente de acuerdo',
          'No hay respuestas correctas o incorrectas.',
          'Responda de forma honesta según su comportamiento habitual.',
          `Tiene ${15} minutos para completar el test.`,
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
        questionType: TestQuestionType.LIKERT_SCALE,
        factor: null,
        options: q.options,
        correctAnswer: null, // No hay respuesta correcta en tests de personalidad
        points: q.points,
        metadata: {
          scaleType: 'likert_5',
          scaleLabels: {
            '1': 'Totalmente en desacuerdo',
            '2': 'En desacuerdo',
            '3': 'Neutral',
            '4': 'De acuerdo',
            '5': 'Totalmente de acuerdo',
          },
        },
      }),
    );

    await fixedTestQuestionRepository.save(questions);
    console.log(`✅ CFR test seeded successfully with ${questions.length} questions`);
  }
}
