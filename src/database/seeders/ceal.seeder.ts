import { DataSource } from 'typeorm';
import { FixedTest } from '../../modules/tests/entities/fixed-test.entity';
import { FixedTestQuestion } from '../../modules/tests/entities/fixed-test-question.entity';
import {
  FixedTestCode,
  TestQuestionType,
} from '../../modules/tests/shared/enums';
import {
  CEAL_ENUNCIADO,
  CEAL_ESTILOS,
  CEAL_INSTRUCCIONES,
  CEAL_NIVELES_EFECTIVIDAD,
  CEAL_PAUTA,
  CEAL_SITUACIONES,
  NumeroEstiloCeal,
} from '../../modules/tests/shared/data/ceal.data';

/**
 * Instrucciones del cuadernillo que hablan del papel (la hoja de respuesta, sus
 * casilleros y el cuadernillo) y no tienen equivalente en la pantalla. Se
 * guardan igual en `instructions`, que es la ficha del test; al candidato se le
 * muestran las demás.
 */
const SOLO_PAPEL = ['hoja de respuesta', 'cuadernillo'];

export class CealSeeder {
  public static async run(dataSource: DataSource): Promise<void> {
    console.log(
      '🌱 Seeding CEAL (Efectividad y Adaptabilidad del Líder) test...',
    );

    const fixedTestRepository = dataSource.getRepository(FixedTest);
    const fixedTestQuestionRepository =
      dataSource.getRepository(FixedTestQuestion);

    const existing = await fixedTestRepository.findOne({
      where: { code: FixedTestCode.TEST_CEAL },
    });

    if (existing) {
      console.log('⚠️  CEAL test already exists. Skipping...');
      return;
    }

    const estilos = ([1, 2, 3, 4] as NumeroEstiloCeal[]).map(
      (n) => CEAL_ESTILOS[n],
    );

    const test = fixedTestRepository.create({
      code: FixedTestCode.TEST_CEAL,
      name: 'Cuestionario de la Efectividad y Adaptabilidad del Líder (CEAL)',
      description: `Mide: ${CEAL_PAUTA.mide} Aplicación: ${CEAL_PAUTA.aplicacion}`,
      // «Es una prueba sin tiempo»
      duration: null,
      isActive: true,
      orderIndex: 7,
      configuration: {
        scoringMethod: 'estilos_y_efectividad_situacional',
        pauta: CEAL_PAUTA,
        nivelesEfectividad: CEAL_NIVELES_EFECTIVIDAD,
        dimensions: estilos.map((e) => ({
          code: String(e.numero),
          name: e.nombre,
          // Cada situación ofrece los cuatro estilos: no hay preguntas «del» estilo.
          questionCount: 0,
          description: `Eficaz: ${e.eficaz.nombre}. Ineficaz: ${e.ineficaz.nombre}.`,
        })),
        instructions: [...CEAL_INSTRUCCIONES, CEAL_ENUNCIADO],
        instruccionesCandidato: [
          ...CEAL_INSTRUCCIONES.filter(
            (i) => !SOLO_PAPEL.some((p) => i.toLowerCase().includes(p)),
          ),
          CEAL_ENUNCIADO,
        ],
      },
    });

    const savedTest = await fixedTestRepository.save(test);
    console.log(`✅ Created test: ${savedTest.name}`);

    const questions = CEAL_SITUACIONES.map((s) =>
      fixedTestQuestionRepository.create({
        fixedTestId: savedTest.id,
        questionNumber: s.numero,
        questionText: s.texto,
        questionType: TestQuestionType.MULTIPLE_CHOICE,
        factor: null,
        options: { ...s.alternativas },
        // La clave (estilo y efectividad de cada letra) vive en ceal.data.ts y
        // la usa el puntuador. No se guarda aquí porque la pregunta completa
        // viaja al navegador del candidato.
        correctAnswer: null,
        metadata: { situacion: s.numero },
      }),
    );

    await fixedTestQuestionRepository.save(questions);
    console.log(
      `✅ CEAL test seeded successfully with ${questions.length} situations`,
    );
  }
}
