import { DataSource } from 'typeorm';
import { FixedTest } from '../../modules/tests/entities/fixed-test.entity';
import { FixedTestQuestion } from '../../modules/tests/entities/fixed-test-question.entity';
import { FixedTestCode, TestQuestionType } from '../../modules/tests/shared/enums';

export class IcSeeder {
  /**
   * Pregunta del test IC (Instrucciones Complejas)
   * Cargada desde el archivo JSON generado a partir del Excel
   */
  private static getQuestions() {
    return require('./data/ic-questions.json');
  }

  public static async run(dataSource: DataSource): Promise<void> {
    console.log('🌱 Seeding IC (Instrucciones Complejas) test...');

    const fixedTestRepository = dataSource.getRepository(FixedTest);
    const fixedTestQuestionRepository = dataSource.getRepository(FixedTestQuestion);

    // Verificar si ya existe
    const existing = await fixedTestRepository.findOne({
      where: { code: FixedTestCode.TEST_IC },
    });

    if (existing) {
      console.log('⚠️  IC test already exists. Skipping...');
      return;
    }

    // Crear el test con su configuración
    const test = fixedTestRepository.create({
      code: FixedTestCode.TEST_IC,
      name: 'Test de Instrucciones Complejas (IC)',
      description:
        'Evaluación de comprensión lectora, capacidad de análisis y razonamiento lógico frente a instrucciones verbales complejas. El candidato debe aplicar múltiples criterios simultáneamente sobre una tabla de datos.',
      duration: 12, // 12 minutos
      isActive: true,
      orderIndex: 5,
      configuration: {
        scoringMethod: 'sum',
        maxScore: 20,
        interpretation: {
          muy_bajo: {
            min: 0,
            max: 4,
            description: 'Dificultad notable para seguir instrucciones complejas.',
          },
          bajo: {
            min: 5,
            max: 8,
            description: 'Dificultad moderada, errores frecuentes de interpretación.',
          },
          promedio: {
            min: 9,
            max: 12,
            description: 'Comprensión adecuada, algunos errores por descuido.',
          },
          alto: {
            min: 13,
            max: 16,
            description: 'Buena comprensión y atención.',
          },
          muy_alto: {
            min: 17,
            max: 20,
            description: 'Excelente nivel de comprensión lógica y atención al detalle.',
          },
        },
        instructions: [
          'Este test evalúa su capacidad para seguir instrucciones complejas.',
          'Se le presenta una tabla con datos de seguros y 3 instrucciones.',
          'Cada instrucción describe criterios específicos (tipo, monto, fecha).',
          'Debe marcar con X en la columna indicada las filas que cumplen TODOS los criterios.',
          'Lea cada instrucción cuidadosamente antes de comenzar.',
          'Por cada marca correcta obtiene 1 punto.',
          'Las marcas incorrectas o faltantes no suman puntos.',
          `Tiene ${12} minutos para completar el test.`,
        ],
      },
    });

    const savedTest = await fixedTestRepository.save(test);
    console.log(`✅ Created test: ${savedTest.name}`);

    // Cargar la pregunta (solo hay 1 pregunta con toda la tabla)
    const questionsData = this.getQuestions();
    console.log(`📝 Loading ${questionsData.length} question (table exercise)...`);

    const questions = questionsData.map((q: any) =>
      fixedTestQuestionRepository.create({
        fixedTestId: savedTest.id,
        questionNumber: q.questionNumber,
        questionText: q.questionText,
        questionType: TestQuestionType.TABLE_CHECKBOX,
        factor: null,
        options: {
          instructions: q.instructions,
          tableHeaders: q.tableHeaders,
          tableData: q.tableData,
        },
        correctAnswer: q.correctAnswer,
        points: q.points,
        metadata: {
          totalRows: q.tableData.length,
          totalColumns: 3,
          maxPoints: q.points,
        },
      }),
    );

    await fixedTestQuestionRepository.save(questions);
    console.log(`✅ IC test seeded successfully with table exercise (${questions[0].points} possible points)`);
  }
}
