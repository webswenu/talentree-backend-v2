import { DataSource } from 'typeorm';
import { FixedTest } from '../../modules/tests/entities/fixed-test.entity';
import { FixedTestQuestion } from '../../modules/tests/entities/fixed-test-question.entity';
import { FixedTestCode, TestQuestionType } from '../../modules/tests/shared/enums';

export class TacSeeder {
  /**
   * Preguntas del test TAC (Test de Atención al Cliente)
   * Cargadas desde el archivo JSON generado a partir del Excel
   */
  private static getQuestions() {
    return require('./data/tac-questions.json');
  }

  public static async run(dataSource: DataSource): Promise<void> {
    console.log('🌱 Seeding TAC (Test de Atención al Cliente) test...');

    const fixedTestRepository = dataSource.getRepository(FixedTest);
    const fixedTestQuestionRepository = dataSource.getRepository(FixedTestQuestion);

    // Verificar si ya existe
    const existing = await fixedTestRepository.findOne({
      where: { code: FixedTestCode.TEST_TAC },
    });

    if (existing) {
      console.log('⚠️  TAC test already exists. Skipping...');
      return;
    }

    // Crear el test con su configuración
    const test = fixedTestRepository.create({
      code: FixedTestCode.TEST_TAC,
      name: 'Test de Atención al Cliente',
      description:
        'Evaluación de competencias para roles de atención al cliente mediante 30 afirmaciones sobre habilidades de servicio. Utiliza escala Likert (1-5) para medir 7 dimensiones: Orientación al Cliente, Comunicación Efectiva, Empatía, Resolución de Problemas, Tolerancia a la Frustración, Trabajo Bajo Presión, y Actitud Positiva.',
      duration: 20, // 20 minutos para 30 preguntas Likert
      isActive: true,
      orderIndex: 6,
      configuration: {
        scoringMethod: 'average_by_dimension',
        dimensions: [
          {
            code: 'D1',
            name: 'Orientación al Cliente',
            questionCount: 4,
            description: 'Enfoque en satisfacer necesidades del cliente',
          },
          {
            code: 'D2',
            name: 'Comunicación Efectiva',
            questionCount: 4,
            description: 'Claridad, escucha activa y comunicación respetuosa',
          },
          {
            code: 'D3',
            name: 'Empatía',
            questionCount: 4,
            description: 'Capacidad de comprender y conectar emocionalmente',
          },
          {
            code: 'D4',
            name: 'Resolución de Problemas',
            questionCount: 4,
            description: 'Búsqueda de soluciones rápidas y efectivas',
          },
          {
            code: 'D5',
            name: 'Tolerancia a la Frustración',
            questionCount: 4,
            description: 'Manejo de situaciones difíciles y clientes exigentes',
          },
          {
            code: 'D6',
            name: 'Trabajo Bajo Presión',
            questionCount: 4,
            description: 'Capacidad de mantener calidad en alta demanda',
          },
          {
            code: 'D7',
            name: 'Actitud Positiva y Colaboración',
            questionCount: 6,
            description: 'Mantenimiento de actitud constructiva y trabajo en equipo',
          },
        ],
        interpretation: {
          excelente: {
            min: 4.0,
            max: 5.0,
            description:
              'Perfil excepcional para atención al cliente - Todas las competencias altamente desarrolladas',
          },
          adecuado: {
            min: 3.0,
            max: 3.9,
            description:
              'Perfil adecuado para atención al cliente - Competencias bien desarrolladas con áreas de oportunidad',
          },
          en_desarrollo: {
            min: 2.0,
            max: 2.9,
            description:
              'Requiere desarrollo - Necesita capacitación en múltiples competencias',
          },
          requiere_mejora: {
            min: 1.0,
            max: 1.9,
            description:
              'Perfil no recomendado - Requiere mejora significativa en competencias clave',
          },
        },
        instructions: [
          'Este test evalúa sus competencias para atención al cliente.',
          'Contiene 30 afirmaciones sobre habilidades y actitudes de servicio.',
          'Para cada afirmación, indique la frecuencia con que actúa así:',
          '  1 = Nunca',
          '  2 = Rara vez',
          '  3 = A veces',
          '  4 = Frecuentemente',
          '  5 = Siempre',
          'No hay respuestas correctas o incorrectas.',
          'Responda de forma honesta según su comportamiento habitual.',
          'Tiene 20 minutos para completar el test.',
        ],
      },
    });

    const savedTest = await fixedTestRepository.save(test);
    console.log(`✅ Created test: ${savedTest.name}`);

    // Cargar las preguntas
    const questionsData = this.getQuestions();
    console.log(`📝 Loading ${questionsData.length} questions...`);

    // Mapeo de dimensiones a códigos cortos
    const dimensionCodes: Record<string, string> = {
      'Orientación al Cliente': 'D1',
      'Comunicación Efectiva': 'D2',
      'Empatía': 'D3',
      'Resolución de Problemas': 'D4',
      'Tolerancia a la Frustración': 'D5',
      'Trabajo Bajo Presión': 'D6',
      'Actitud Positiva y Colaboración': 'D7',
    };

    const questions = questionsData.map((q: any) =>
      fixedTestQuestionRepository.create({
        fixedTestId: savedTest.id,
        questionNumber: q.questionNumber,
        questionText: q.questionText,
        questionType: TestQuestionType.LIKERT_SCALE,
        factor: dimensionCodes[q.dimension] || 'D1', // Usar código corto
        options: q.options,
        correctAnswer: null, // No hay respuesta correcta en tests de competencias
        points: q.points,
        metadata: {
          scaleType: 'likert_5',
          scaleLabels: {
            '1': 'Nunca',
            '2': 'Rara vez',
            '3': 'A veces',
            '4': 'Frecuentemente',
            '5': 'Siempre',
          },
          dimension: q.dimension, // Nombre completo en metadata
          dimensionCode: dimensionCodes[q.dimension] || 'D1',
        },
      }),
    );

    await fixedTestQuestionRepository.save(questions);
    console.log(
      `✅ TAC test seeded successfully with ${questions.length} questions`,
    );
  }
}
