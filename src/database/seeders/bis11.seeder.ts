import { DataSource } from 'typeorm';
import { FixedTest } from '../../modules/tests/entities/fixed-test.entity';
import { FixedTestQuestion } from '../../modules/tests/entities/fixed-test-question.entity';
import {
  FixedTestCode,
  TestQuestionType,
} from '../../modules/tests/shared/enums';
import {
  BIS11_DIMENSIONES,
  BIS11_INSTRUCCIONES,
  BIS11_ITEMS,
  BIS11_NOTA_TABULACION,
  BIS11_OPCIONES,
  BIS11_REFERENCIA_TOTAL,
  DimensionBis11,
} from '../../modules/tests/shared/data/bis11.data';

export class Bis11Seeder {
  public static async run(dataSource: DataSource): Promise<void> {
    console.log(
      '🌱 Seeding BIS-11 (Escala de Impulsividad de Barratt) test...',
    );

    const fixedTestRepository = dataSource.getRepository(FixedTest);
    const fixedTestQuestionRepository =
      dataSource.getRepository(FixedTestQuestion);

    const existing = await fixedTestRepository.findOne({
      where: { code: FixedTestCode.TEST_BIS11 },
    });

    if (existing) {
      console.log('⚠️  BIS-11 test already exists. Skipping...');
      return;
    }

    const test = fixedTestRepository.create({
      code: FixedTestCode.TEST_BIS11,
      name: 'Escala de Impulsividad de Barratt (BIS-11)',
      description:
        'Escala de 30 ítems: 8 de impulsividad atencional, 10 de impulsividad motora y 12 de no planificación.',
      // El instrumento no fija tiempo: pide no detenerse demasiado en las oraciones.
      duration: null,
      isActive: true,
      orderIndex: 8,
      configuration: {
        scoringMethod: 'suma_corregida_por_dimension',
        escala: BIS11_OPCIONES,
        itemsInversos: BIS11_ITEMS.filter((i) => i.inverso).map(
          (i) => i.numero,
        ),
        referenciaTotal: BIS11_REFERENCIA_TOTAL,
        dimensions: (Object.keys(BIS11_DIMENSIONES) as DimensionBis11[]).map(
          (clave) => {
            const items = BIS11_ITEMS.filter((i) => i.dimension === clave);
            return {
              code: BIS11_DIMENSIONES[clave].factor,
              name: BIS11_DIMENSIONES[clave].nombre,
              questionCount: items.length,
              description: `Ítems ${items.map((i) => i.numero).join(', ')}. Puntaje máximo ${items.length * 4}.`,
            };
          },
        ),
        instructions: [BIS11_INSTRUCCIONES, BIS11_NOTA_TABULACION],
        instruccionesCandidato: [BIS11_INSTRUCCIONES],
      },
    });

    const savedTest = await fixedTestRepository.save(test);
    console.log(`✅ Created test: ${savedTest.name}`);

    const opciones = Object.fromEntries(
      BIS11_OPCIONES.map((o) => [o.clave, o.texto]),
    );

    const questions = BIS11_ITEMS.map((item) =>
      fixedTestQuestionRepository.create({
        fixedTestId: savedTest.id,
        questionNumber: item.numero,
        questionText: item.texto,
        questionType: TestQuestionType.MULTIPLE_CHOICE,
        factor: BIS11_DIMENSIONES[item.dimension].factor,
        options: { ...opciones },
        correctAnswer: null,
        // Qué ítems se invierten y el valor de cada opción viven en
        // bis11.data.ts y los usa el puntuador.
        metadata: { dimension: item.dimension },
      }),
    );

    await fixedTestQuestionRepository.save(questions);
    console.log(
      `✅ BIS-11 test seeded successfully with ${questions.length} items`,
    );
  }
}
