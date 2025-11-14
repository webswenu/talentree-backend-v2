import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Test } from '../../modules/tests/entities/test.entity';
import { TestQuestion } from '../../modules/tests/entities/test-question.entity';
import { TestType } from '../../modules/tests/enums/test-type.enum';
import { QuestionType } from '../../modules/tests/enums/question-type.enum';

@Injectable()
export class TestSeeder {
  constructor(
    @InjectRepository(Test)
    private readonly testRepository: Repository<Test>,
    @InjectRepository(TestQuestion)
    private readonly questionRepository: Repository<TestQuestion>,
  ) {}

  async seed() {
    const psychometricTest = await this.createTestIfNotExists({
      name: 'Test Psicométrico General',
      description:
        'Evaluación de habilidades cognitivas, razonamiento lógico y personalidad. Este test evalúa diferentes aspectos cognitivos. Lee cada pregunta cuidadosamente y selecciona la respuesta que mejor represente tu opinión. Tienes 60 minutos para completar el test.',
      type: TestType.PSYCHOMETRIC,
      duration: 60,
      passingScore: 70,
      isActive: true,
    });

    if (psychometricTest) {
      await this.createQuestions(psychometricTest, [
        {
          question:
            '¿Cuál es el siguiente número en la secuencia? 2, 4, 8, 16, __',
          type: QuestionType.MULTIPLE_CHOICE,
          options: ['24', '32', '28', '20'],
          correctAnswers: ['32'],
          points: 5,
          order: 1,
        },
        {
          question:
            'Si todos los gatos son animales y algunos animales son mascotas, entonces:',
          type: QuestionType.MULTIPLE_CHOICE,
          options: [
            'Todos los gatos son mascotas',
            'Algunos gatos podrían ser mascotas',
            'Ningún gato es mascota',
            'No se puede determinar',
          ],
          correctAnswers: ['Algunos gatos podrían ser mascotas'],
          points: 5,
          order: 2,
        },
        {
          question: 'Prefiero trabajar en equipo que solo',
          type: QuestionType.SCALE,
          options: [
            'Totalmente en desacuerdo',
            'En desacuerdo',
            'Neutral',
            'De acuerdo',
            'Totalmente de acuerdo',
          ],
          points: 3,
          order: 3,
        },
        {
          question: 'Me adapto fácilmente a los cambios',
          type: QuestionType.SCALE,
          options: [
            'Totalmente en desacuerdo',
            'En desacuerdo',
            'Neutral',
            'De acuerdo',
            'Totalmente de acuerdo',
          ],
          points: 3,
          order: 4,
        },
        {
          question:
            'Completa la analogía: Día es a Noche como Verano es a ____',
          type: QuestionType.MULTIPLE_CHOICE,
          options: ['Otoño', 'Invierno', 'Primavera', 'Calor'],
          correctAnswers: ['Invierno'],
          points: 5,
          order: 5,
        },
      ]);
    }

    const technicalTest = await this.createTestIfNotExists({
      name: 'Test Técnico - Operación de Equipos',
      description:
        'Evaluación de conocimientos técnicos para operadores de equipos mineros. Responde basándote en tus conocimientos y experiencia. Cada pregunta tiene solo una respuesta correcta. Tienes 45 minutos para completar el test. Debes obtener al menos 75% para aprobar.',
      type: TestType.TECHNICAL,
      duration: 45,
      passingScore: 75,
      isActive: true,
    });

    if (technicalTest) {
      await this.createQuestions(technicalTest, [
        {
          question:
            '¿Cuál es la función principal de un sistema hidráulico en equipos mineros?',
          type: QuestionType.MULTIPLE_CHOICE,
          options: [
            'Transmitir potencia mediante fluidos',
            'Enfriar el motor',
            'Filtrar el aire',
            'Generar electricidad',
          ],
          correctAnswers: ['Transmitir potencia mediante fluidos'],
          points: 10,
          order: 1,
        },
        {
          question:
            '¿Qué indica una luz roja en el tablero de un camión minero?',
          type: QuestionType.MULTIPLE_CHOICE,
          options: [
            'Advertencia menor',
            'Sistema funcionando normal',
            'Falla crítica - detener equipo',
            'Mantenimiento programado',
          ],
          correctAnswers: ['Falla crítica - detener equipo'],
          points: 10,
          order: 2,
        },
        {
          question:
            'Antes de iniciar la operación, ¿qué inspección es obligatoria?',
          type: QuestionType.MULTIPLE_CHOICE,
          options: [
            'Solo nivel de combustible',
            'Check list completo del equipo',
            'Únicamente los neumáticos',
            'No es necesaria inspección diaria',
          ],
          correctAnswers: ['Check list completo del equipo'],
          points: 10,
          order: 3,
        },
        {
          question:
            '¿Cuál es el procedimiento correcto ante una falla del sistema de frenos?',
          type: QuestionType.MULTIPLE_CHOICE,
          options: [
            'Continuar con precaución',
            'Detener inmediatamente y reportar',
            'Usar solo freno de motor',
            'Completar el turno y reportar',
          ],
          correctAnswers: ['Detener inmediatamente y reportar'],
          points: 10,
          order: 4,
        },
      ]);
    }

    const safetyTest = await this.createTestIfNotExists({
      name: 'Test de Seguridad Minera',
      description:
        'Evaluación de conocimientos en seguridad y prevención de riesgos. La seguridad es prioritaria en minería. Responde basándote en normativas vigentes. Debes obtener al menos 80% para aprobar. Tienes 30 minutos.',
      type: TestType.SAFETY,
      duration: 30,
      passingScore: 80,
      isActive: true,
    });

    if (safetyTest) {
      await this.createQuestions(safetyTest, [
        {
          question: '¿Cuáles son los elementos básicos de EPP en minería?',
          type: QuestionType.MULTIPLE_CHOICE,
          options: [
            'Solo casco y guantes',
            'Casco, zapatos de seguridad, lentes, guantes y protección auditiva',
            'Únicamente casco',
            'Casco y chaleco reflectante',
          ],
          correctAnswers: [
            'Casco, zapatos de seguridad, lentes, guantes y protección auditiva',
          ],
          points: 10,
          order: 1,
        },
        {
          question:
            '¿Qué significa el triángulo amarillo con signo de exclamación?',
          type: QuestionType.MULTIPLE_CHOICE,
          options: [
            'Prohibición',
            'Advertencia o precaución',
            'Obligación',
            'Información general',
          ],
          correctAnswers: ['Advertencia o precaución'],
          points: 10,
          order: 2,
        },
        {
          question: 'Ante un accidente, ¿cuál es la primera acción?',
          type: QuestionType.MULTIPLE_CHOICE,
          options: [
            'Tomar fotografías',
            'Asegurar la escena y dar aviso inmediato',
            'Completar el papeleo',
            'Continuar trabajando',
          ],
          correctAnswers: ['Asegurar la escena y dar aviso inmediato'],
          points: 10,
          order: 3,
        },
      ]);
    }

    console.log('✅ Seeder de tests completado');
  }

  private async createTestIfNotExists(
    testData: Partial<Test>,
  ): Promise<Test | null> {
    const existing = await this.testRepository.findOne({
      where: { name: testData.name },
    });

    if (existing) {
      console.log(`⚠️  Test ya existe: ${testData.name}`);
      return null;
    }

    const test = this.testRepository.create(testData);
    await this.testRepository.save(test);
    console.log(`✅ Test creado: ${testData.name}`);
    return test;
  }

  private async createQuestions(
    test: Test,
    questions: Partial<TestQuestion>[],
  ) {
    for (const questionData of questions) {
      const question = this.questionRepository.create({
        ...questionData,
        test,
      });
      await this.questionRepository.save(question);
    }
    console.log(
      `   ✅ ${questions.length} preguntas creadas para: ${test.name}`,
    );
  }
}
