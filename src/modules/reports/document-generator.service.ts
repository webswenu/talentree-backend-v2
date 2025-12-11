import { Injectable, Logger } from '@nestjs/common';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  VerticalAlign,
  ImageRun,
} from 'docx';
import { WorkerProcess } from '../workers/entities/worker-process.entity';
import { TestResponse } from '../test-responses/entities/test-response.entity';

// Talentree brand colors (blue theme from web app)
const TALENTREE_COLORS = {
  primary: '3b82f6', // Azul principal de Talentree (primary-500)
  secondary: '1d4ed8', // Azul oscuro (primary-700)
  accent: '60a5fa', // Azul claro (primary-400)
  background: 'dbeafe', // Azul muy claro para fondos (primary-100)
  text: '1A1A1A', // Texto principal
  textLight: '666666', // Texto secundario
  success: '10b981', // Verde para éxito
  warning: 'f59e0b', // Naranja para advertencias
  danger: 'ef4444', // Rojo para peligro
};

@Injectable()
export class DocumentGeneratorService {
  private readonly logger = new Logger(DocumentGeneratorService.name);
  /**
   * Generates a comprehensive DOCX report for a worker's process
   * including all test results, scores, and interpretations
   */
  async generateWorkerProcessReport(
    workerProcess: WorkerProcess,
  ): Promise<Buffer> {
    this.logger.log(`Generating consolidated report for WorkerProcess ${workerProcess.id}`);

    const sections = [];

    // ========== PORTADA / PRIMERA PÁGINA ==========
    sections.push(
      this.createBrandedTitle('INFORME DE EVALUACIÓN PSICOTÉCNICA'),
      this.createEmptyLine(),
      this.createEmptyLine(),
    );

    // Información del candidato en tabla visual
    sections.push(
      this.createSectionHeader('INFORMACIÓN DEL CANDIDATO'),
      this.createCandidateInfoTable(workerProcess),
      this.createEmptyLine(),
    );

    // Información del proceso
    sections.push(
      this.createSectionHeader('INFORMACIÓN DEL PROCESO'),
      this.createProcessInfoTable(workerProcess),
      this.createEmptyLine(),
    );

    // Resumen de tests completados (tabla visual)
    if (workerProcess.testResponses && workerProcess.testResponses.length > 0) {
      sections.push(
        this.createSectionHeader('RESUMEN DE EVALUACIONES'),
        this.createTestsSummaryTable(workerProcess.testResponses),
        this.createEmptyLine(),
      );
    }

    // Salto de página antes de los detalles
    sections.push(this.createPageBreak());

    // ========== DETALLE POR CADA TEST ==========
    if (workerProcess.testResponses && workerProcess.testResponses.length > 0) {
      for (let i = 0; i < workerProcess.testResponses.length; i++) {
        const testResponse = workerProcess.testResponses[i];
        const testSections = await this.createDetailedTestSection(testResponse);
        sections.push(...testSections);

        // Salto de página entre tests (excepto el último)
        if (i < workerProcess.testResponses.length - 1) {
          sections.push(this.createPageBreak());
        }
      }
    } else {
      sections.push(
        new Paragraph({
          text: 'No se encontraron evaluaciones completadas.',
          spacing: { before: 200, after: 200 },
        }),
      );
    }

    // ========== CONCLUSIONES Y PIE DE PÁGINA ==========
    sections.push(
      this.createPageBreak(),
      this.createSectionHeader('CONCLUSIONES Y RECOMENDACIONES'),
      ...this.createConclusionsSection(workerProcess),
      this.createEmptyLine(),
      this.createEmptyLine(),
    );

    // Footer
    sections.push(
      this.createFooter(),
    );

    // Create the document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: sections,
        },
      ],
    });

    // Convert to buffer
    const buffer = await Packer.toBuffer(doc);
    this.logger.log(`Report generated successfully for WorkerProcess ${workerProcess.id}`);
    return buffer;
  }

  // ========== HELPER METHODS - FORMATO BÁSICO ==========

  private createBrandedTitle(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: text,
          bold: true,
          size: 32,
          color: TALENTREE_COLORS.primary,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 400 },
      border: {
        bottom: {
          color: TALENTREE_COLORS.primary,
          space: 1,
          style: BorderStyle.SINGLE,
          size: 20,
        },
      },
    });
  }

  private createSectionHeader(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: text,
          bold: true,
          size: 24,
          color: 'FFFFFF',
        }),
      ],
      alignment: AlignmentType.LEFT,
      spacing: { before: 300, after: 200 },
      shading: {
        type: ShadingType.SOLID,
        color: TALENTREE_COLORS.primary,
      },
    });
  }

  private createSubHeading(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: text,
          bold: true,
          size: 20,
          color: TALENTREE_COLORS.secondary,
        }),
      ],
      spacing: { before: 200, after: 150 },
    });
  }

  private createEmptyLine(): Paragraph {
    return new Paragraph({ text: '' });
  }

  private createPageBreak(): Paragraph {
    return new Paragraph({
      text: '',
      pageBreakBefore: true,
    });
  }

  private createFooter(): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: `Reporte generado el ${new Date().toLocaleDateString('es-CL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })} | `,
          size: 18,
          color: TALENTREE_COLORS.textLight,
        }),
        new TextRun({
          text: '© Talentree - Sistema de Gestión de Talento',
          size: 18,
          color: TALENTREE_COLORS.primary,
          bold: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      border: {
        top: {
          color: TALENTREE_COLORS.accent,
          space: 1,
          style: BorderStyle.SINGLE,
          size: 10,
        },
      },
    });
  }

  // ========== TABLA DE INFORMACIÓN DEL CANDIDATO ==========

  private createCandidateInfoTable(workerProcess: WorkerProcess): Table {
    const worker = workerProcess.worker;

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: TALENTREE_COLORS.accent },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: TALENTREE_COLORS.accent },
        left: { style: BorderStyle.SINGLE, size: 1, color: TALENTREE_COLORS.accent },
        right: { style: BorderStyle.SINGLE, size: 1, color: TALENTREE_COLORS.accent },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: TALENTREE_COLORS.background },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: TALENTREE_COLORS.background },
      },
      rows: [
        this.createInfoTableRow('Nombre Completo', worker ? `${worker.firstName} ${worker.lastName}` : 'N/A'),
        this.createInfoTableRow('RUT', worker?.rut || 'N/A'),
        this.createInfoTableRow('Email', worker?.user?.email || worker?.email || 'N/A'),
        this.createInfoTableRow('Teléfono', worker?.phone || 'N/A'),
        this.createInfoTableRow(
          'Fecha de Postulación',
          workerProcess.appliedAt
            ? new Date(workerProcess.appliedAt).toLocaleDateString('es-CL', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
            : 'N/A'
        ),
      ],
    });
  }

  private createProcessInfoTable(workerProcess: WorkerProcess): Table {
    const process = workerProcess.process;

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: TALENTREE_COLORS.accent },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: TALENTREE_COLORS.accent },
        left: { style: BorderStyle.SINGLE, size: 1, color: TALENTREE_COLORS.accent },
        right: { style: BorderStyle.SINGLE, size: 1, color: TALENTREE_COLORS.accent },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: TALENTREE_COLORS.background },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: TALENTREE_COLORS.background },
      },
      rows: [
        this.createInfoTableRow('Nombre del Proceso', process?.name || 'N/A'),
        this.createInfoTableRow('Empresa', process?.company?.name || 'N/A'),
        this.createInfoTableRow('Estado', this.translateStatus(workerProcess.status)),
        this.createInfoTableRow(
          'Fecha de Evaluación',
          workerProcess.evaluatedAt
            ? new Date(workerProcess.evaluatedAt).toLocaleDateString('es-CL', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
            : 'Pendiente'
        ),
      ],
    });
  }

  private createInfoTableRow(label: string, value: string): TableRow {
    return new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: label,
                  bold: true,
                  color: TALENTREE_COLORS.secondary,
                }),
              ],
            }),
          ],
          width: { size: 35, type: WidthType.PERCENTAGE },
          shading: {
            type: ShadingType.SOLID,
            color: TALENTREE_COLORS.background,
          },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: value,
                  color: TALENTREE_COLORS.text,
                }),
              ],
            }),
          ],
          width: { size: 65, type: WidthType.PERCENTAGE },
        }),
      ],
    });
  }

  // ========== TABLA RESUMEN DE TODOS LOS TESTS ==========

  private createTestsSummaryTable(testResponses: TestResponse[]): Table {
    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        this.createTableHeaderCell('Evaluación'),
        this.createTableHeaderCell('Estado'),
        this.createTableHeaderCell('Fecha Inicio'),
        this.createTableHeaderCell('Fecha Fin'),
        this.createTableHeaderCell('Resultado'),
      ],
    });

    const dataRows = testResponses.map((tr) => {
      const testName = tr.fixedTest?.name || tr.test?.name || 'Test sin nombre';

      // Determine status based on test response status field
      let status = 'Pendiente';
      let statusColor = TALENTREE_COLORS.warning;

      if (tr.status === 'completed') {
        status = '✓ Completado';
        statusColor = TALENTREE_COLORS.success;
      } else if (tr.status === 'insufficient_answers') {
        status = '⚠️ Incompleto';
        statusColor = TALENTREE_COLORS.warning;
      } else if (tr.isCompleted && !tr.status) {
        // Fallback for old data that might not have status field
        status = '✓ Completado';
        statusColor = TALENTREE_COLORS.success;
      }

      const startDate = tr.startedAt
        ? new Date(tr.startedAt).toLocaleDateString('es-CL')
        : '-';

      const endDate = tr.completedAt
        ? new Date(tr.completedAt).toLocaleDateString('es-CL')
        : '-';

      let result = '-';
      if (tr.interpretation?.nivel) {
        result = `${tr.interpretation.nivel}`;
      } else if (tr.score !== null && tr.maxScore !== null) {
        const percentage = Math.round((tr.score / tr.maxScore) * 100);
        result = `${percentage}%`;
      }

      return new TableRow({
        children: [
          this.createTableCell(testName),
          this.createTableCellWithColor(status, statusColor),
          this.createTableCell(startDate),
          this.createTableCell(endDate),
          this.createTableCell(result),
        ],
      });
    });

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    });
  }

  private createTableHeaderCell(text: string): TableCell {
    return new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: text,
              bold: true,
              color: 'FFFFFF',
              size: 20,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      ],
      shading: {
        type: ShadingType.SOLID,
        color: TALENTREE_COLORS.secondary,
      },
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  private createTableCell(text: string): TableCell {
    return new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: text,
              size: 18,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  private createTableCellWithColor(text: string, color: string): TableCell {
    return new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: text,
              size: 18,
              color: color,
              bold: true,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  // ========== SECCIÓN DETALLADA DE CADA TEST ==========

  private async createDetailedTestSection(testResponse: TestResponse): Promise<Paragraph[]> {
    const sections: Paragraph[] = [];

    // Test name with branding
    const testName = testResponse.fixedTest?.name || testResponse.test?.name || 'Test sin nombre';
    const testCode = testResponse.fixedTest?.code || '';

    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: testName,
            bold: true,
            size: 28,
            color: TALENTREE_COLORS.secondary,
          }),
        ],
        spacing: { before: 200, after: 300 },
        border: {
          bottom: {
            color: TALENTREE_COLORS.accent,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 15,
          },
        },
      }),
    );

    // Check if test has insufficient answers
    if (testResponse.status === 'insufficient_answers') {
      const metadata = testResponse.metadata as any;
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '⚠️ TEST INCOMPLETO',
              bold: true,
              size: 24,
              color: 'FF6B00', // Orange color for warning
            }),
          ],
          spacing: { before: 200, after: 200 },
        }),
        new Paragraph({
          text: `Este test no fue completado por el candidato. ${
            metadata?.answeredQuestions !== undefined
              ? `Se respondieron ${metadata.answeredQuestions} de ${metadata.totalQuestions} preguntas (${metadata.answerPercentage}%).`
              : 'No se registraron respuestas suficientes.'
          }`,
          spacing: { before: 100, after: 300 },
        }),
      );
      return sections;
    }

    // Información básica del test
    const testDescr = testResponse.fixedTest?.description || testResponse.test?.description;
    if (testDescr) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Descripción: ',
              bold: true,
              size: 20,
            }),
            new TextRun({
              text: testDescr,
              size: 20,
            }),
          ],
          spacing: { before: 150, after: 150 },
        }),
      );
    }

    // Fechas
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Fecha de Inicio: ', bold: true, size: 18 }),
          new TextRun({
            text: testResponse.startedAt
              ? new Date(testResponse.startedAt).toLocaleDateString('es-CL', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'N/A',
            size: 18,
          }),
        ],
        spacing: { before: 100, after: 50 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Fecha de Finalización: ', bold: true, size: 18 }),
          new TextRun({
            text: testResponse.completedAt
              ? new Date(testResponse.completedAt).toLocaleDateString('es-CL', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'No completado',
            size: 18,
          }),
        ],
        spacing: { before: 50, after: 150 },
      }),
    );

    // Scores para tests con puntuación numérica
    if (testResponse.score !== null && testResponse.maxScore !== null) {
      const percentage = Math.round((testResponse.score / testResponse.maxScore) * 100);
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Puntuación Obtenida: ', bold: true, size: 18 }),
            new TextRun({
              text: `${testResponse.score} / ${testResponse.maxScore} (${percentage}%)`,
              size: 18,
              color: percentage >= 70 ? TALENTREE_COLORS.success : TALENTREE_COLORS.warning,
              bold: true,
            }),
          ],
          spacing: { before: 100, after: 200 },
        }),
      );
    }

    // Raw Scores - Generate chart for 16PF
    if (testResponse.rawScores && Object.keys(testResponse.rawScores).length > 0) {
      const testCode = testResponse.fixedTest?.code || '';

      // For 16PF, show chart instead of list
      if (testCode === 'TEST_16PF' || Object.keys(testResponse.rawScores).length >= 10) {
        try {
          const rawChartBuffer = await this.generateRawScoresChart(testResponse.rawScores as Record<string, number>);
          if (rawChartBuffer) {
            sections.push(
              this.createEmptyLine(),
              new Paragraph({
                children: [new TextRun({ text: 'Puntuaciones Directas por Factor:', bold: true, size: 22 })],
                spacing: { before: 200, after: 100 },
              }),
              this.createChartParagraph(rawChartBuffer),
            );
          }
        } catch (error) {
          this.logger.warn(`Could not generate raw scores chart: ${error.message}`);
          // Fallback to list if chart fails
          sections.push(
            this.createEmptyLine(),
            new Paragraph({
              children: [new TextRun({ text: 'Puntuaciones por Factor:', bold: true })],
              spacing: { before: 200, after: 100 },
            }),
          );
          for (const [factor, score] of Object.entries(testResponse.rawScores)) {
            sections.push(
              new Paragraph({
                text: `  • ${factor}: ${score}`,
                spacing: { before: 50, after: 50 },
                bullet: { level: 0 },
              }),
            );
          }
        }
      } else {
        // For other tests, show list
        sections.push(
          this.createEmptyLine(),
          new Paragraph({
            children: [new TextRun({ text: 'Puntuaciones por Factor:', bold: true })],
            spacing: { before: 200, after: 100 },
          }),
        );
        for (const [factor, score] of Object.entries(testResponse.rawScores)) {
          sections.push(
            new Paragraph({
              text: `  • ${factor}: ${score}`,
              spacing: { before: 50, after: 50 },
              bullet: { level: 0 },
            }),
          );
        }
      }
    }

    // Scaled Scores (for 16PF decatipos, etc.) - Only show chart, not list
    if (testResponse.scaledScores && Object.keys(testResponse.scaledScores).length > 0) {
      const testCode = testResponse.fixedTest?.code || '';

      // For 16PF, show only the chart (no list)
      if (testCode === 'TEST_16PF' || Object.keys(testResponse.scaledScores).length >= 10) {
        try {
          const chartBuffer = await this.generate16PFChart(testResponse.scaledScores as Record<string, number>);
          if (chartBuffer) {
            sections.push(
              this.createEmptyLine(),
              new Paragraph({
                children: [new TextRun({ text: 'Perfil de Personalidad - Decatipos:', bold: true, size: 22 })],
                spacing: { before: 200, after: 100 },
              }),
              this.createChartParagraph(chartBuffer),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Leyenda: ', bold: true, size: 16, color: TALENTREE_COLORS.textLight }),
                  new TextRun({ text: '■ Rojo (1-3): Bajo ', size: 16, color: 'ef4444' }),
                  new TextRun({ text: '■ Azul (4-7): Medio ', size: 16, color: '3b82f6' }),
                  new TextRun({ text: '■ Verde (8-10): Alto', size: 16, color: '10b981' }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 50, after: 150 },
              }),
            );
          }
        } catch (error) {
          this.logger.warn(`Could not generate decatipo chart: ${error.message}`);
          // Fallback to list if chart fails
          sections.push(
            this.createEmptyLine(),
            new Paragraph({
              children: [new TextRun({ text: 'Puntuaciones Escaladas (Decatipos):', bold: true })],
              spacing: { before: 200, after: 100 },
            }),
          );
          for (const [factor, score] of Object.entries(testResponse.scaledScores)) {
            sections.push(
              new Paragraph({
                text: `  • ${factor}: ${score}`,
                spacing: { before: 50, after: 50 },
                bullet: { level: 0 },
              }),
            );
          }
        }
      } else {
        // For other tests, show list
        sections.push(
          this.createEmptyLine(),
          new Paragraph({
            children: [new TextRun({ text: 'Puntuaciones Escaladas:', bold: true })],
            spacing: { before: 200, after: 100 },
          }),
        );
        for (const [factor, score] of Object.entries(testResponse.scaledScores)) {
          sections.push(
            new Paragraph({
              text: `  • ${factor}: ${score}`,
              spacing: { before: 50, after: 50 },
              bullet: { level: 0 },
            }),
          );
        }
      }
    }

    // Interpretation
    if (testResponse.interpretation) {
      sections.push(
        this.createEmptyLine(),
        new Paragraph({
          children: [new TextRun({ text: 'Interpretación de Resultados:', bold: true })],
          spacing: { before: 200, after: 100 },
        }),
      );

      // Handle different interpretation structures
      if (typeof testResponse.interpretation === 'string') {
        sections.push(
          new Paragraph({
            text: testResponse.interpretation,
            spacing: { before: 100, after: 100 },
          }),
        );
      } else if (typeof testResponse.interpretation === 'object') {
        for (const [key, value] of Object.entries(testResponse.interpretation)) {
          if (typeof value === 'string') {
            sections.push(
              new Paragraph({
                text: `  • ${key}: ${value}`,
                spacing: { before: 50, after: 50 },
                bullet: { level: 0 },
              }),
            );
          } else if (Array.isArray(value)) {
            // Handle arrays (like recomendaciones)
            sections.push(
              new Paragraph({
                children: [new TextRun({ text: `${key}:`, bold: true })],
                spacing: { before: 100, after: 50 },
              }),
            );
            for (const item of value) {
              sections.push(
                new Paragraph({
                  text: `  • ${typeof item === 'object' ? JSON.stringify(item) : item}`,
                  spacing: { before: 25, after: 25 },
                  bullet: { level: 0 },
                }),
              );
            }
          } else if (typeof value === 'object' && value !== null) {
            // Handle nested objects (like factorDescriptions)
            if (key === 'factorDescriptions') {
              // Special handling for 16PF factor descriptions
              sections.push(
                new Paragraph({
                  children: [new TextRun({ text: 'Descripción por Factor:', bold: true, size: 22 })],
                  spacing: { before: 150, after: 100 },
                }),
              );
              for (const [factor, factorData] of Object.entries(value as Record<string, any>)) {
                const fd = factorData as { decatipo?: number; nivel?: string; descripcion?: string };
                sections.push(
                  new Paragraph({
                    children: [
                      new TextRun({ text: `Factor ${factor}: `, bold: true }),
                      new TextRun({ text: `DT=${fd.decatipo || 'N/A'} `, color: TALENTREE_COLORS.primary }),
                      new TextRun({ text: `(${fd.nivel || 'N/A'}) ` }),
                      new TextRun({ text: `- ${fd.descripcion || 'Sin descripción'}`, italics: true }),
                    ],
                    spacing: { before: 50, after: 50 },
                  }),
                );
              }
            } else {
              // Generic nested object handling
              sections.push(
                new Paragraph({
                  children: [new TextRun({ text: `${key}:`, bold: true })],
                  spacing: { before: 100, after: 50 },
                }),
              );
              for (const [subKey, subValue] of Object.entries(value)) {
                const displayValue = typeof subValue === 'object' && subValue !== null
                  ? JSON.stringify(subValue)
                  : String(subValue);
                sections.push(
                  new Paragraph({
                    text: `  • ${subKey}: ${displayValue}`,
                    spacing: { before: 25, after: 25 },
                    bullet: { level: 0 },
                  }),
                );
              }
            }
          }
        }
      }
    }

    // Evaluator notes
    if (testResponse.evaluatorNotes) {
      sections.push(
        this.createEmptyLine(),
        new Paragraph({
          children: [new TextRun({ text: 'Notas del Evaluador:', bold: true })],
          spacing: { before: 200, after: 100 },
        }),
        new Paragraph({
          text: testResponse.evaluatorNotes,
          spacing: { before: 100, after: 100 },
        }),
      );
    }

    sections.push(this.createEmptyLine());

    return sections;
  }

  // ========== SECCIÓN DE CONCLUSIONES ==========

  private createConclusionsSection(workerProcess: WorkerProcess): Paragraph[] {
    const sections: Paragraph[] = [];

    const completedTests = workerProcess.testResponses?.filter(
      (tr) => tr.isCompleted,
    ).length || 0;
    const totalTests = workerProcess.testResponses?.length || 0;

    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Se completaron ${completedTests} de ${totalTests} evaluaciones asignadas para este proceso de selección.`,
            size: 22,
          }),
        ],
        spacing: { before: 200, after: 200 },
      }),
    );

    // Resumen de resultados clave
    const keyFindings: string[] = [];

    workerProcess.testResponses?.forEach((tr) => {
      if (tr.interpretation) {
        const testName = tr.fixedTest?.name || tr.test?.name;

        if (tr.interpretation.nivel) {
          keyFindings.push(
            `${testName}: Nivel ${tr.interpretation.nivel} - ${tr.interpretation.riesgo || ''}`,
          );
        }

        // Agregar recomendaciones importantes
        if (tr.interpretation.recomendacion) {
          keyFindings.push(`  → ${tr.interpretation.recomendacion}`);
        }
      }
    });

    if (keyFindings.length > 0) {
      sections.push(
        this.createSubHeading('Resumen de Hallazgos Clave'),
        ...keyFindings.map(
          (finding) =>
            new Paragraph({
              children: [
                new TextRun({
                  text: finding,
                  size: 20,
                }),
              ],
              spacing: { before: 100, after: 100 },
              bullet: { level: 0 },
            }),
        ),
      );
    }

    if (workerProcess.notes) {
      sections.push(
        this.createEmptyLine(),
        this.createSubHeading('Observaciones del Evaluador'),
        new Paragraph({
          children: [
            new TextRun({
              text: workerProcess.notes,
              size: 20,
            }),
          ],
          spacing: { before: 100, after: 100 },
        }),
      );
    }

    sections.push(
      this.createEmptyLine(),
      new Paragraph({
        children: [
          new TextRun({
            text: 'Nota: ',
            bold: true,
            size: 18,
            color: TALENTREE_COLORS.textLight,
          }),
          new TextRun({
            text: 'Este reporte es un documento editable. Los evaluadores pueden modificar y agregar observaciones adicionales según sea necesario.',
            size: 18,
            color: TALENTREE_COLORS.textLight,
            italics: true,
          }),
        ],
        spacing: { before: 300 },
        border: {
          top: {
            color: TALENTREE_COLORS.background,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 10,
          },
        },
      }),
    );

    return sections;
  }

  // ========== UTILIDADES ==========

  private translateStatus(status: string): string {
    const statusMap: Record<string, string> = {
      pending: 'Pendiente',
      in_process: 'En Proceso',
      in_review: 'En Revisión',
      approved: 'Aprobado',
      rejected: 'Rechazado',
      completed: 'Completado',
    };
    return statusMap[status] || status;
  }

  // ========== GENERACIÓN DE GRÁFICOS ==========

  /**
   * Generates a horizontal bar chart for raw scores (Puntuaciones Directas)
   * @param rawScores Object with factor names as keys and raw score values
   * @returns Buffer with PNG image data, or null if generation fails
   */
  private async generateRawScoresChart(rawScores: Record<string, number>): Promise<Buffer | null> {
    try {
      const factors = Object.keys(rawScores);
      const values = Object.values(rawScores);
      const maxValue = Math.max(...values) + 2; // Add padding

      const chartConfig = {
        type: 'horizontalBar',
        data: {
          labels: factors,
          datasets: [{
            label: 'Puntuación Directa',
            data: values,
            backgroundColor: 'rgba(59, 130, 246, 0.7)',  // Blue
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 1,
          }]
        },
        options: {
          indexAxis: 'y',
          scales: {
            xAxes: [{
              ticks: {
                beginAtZero: true,
                max: maxValue,
              },
              scaleLabel: {
                display: true,
                labelString: 'Puntuación Directa (PD)',
                fontStyle: 'bold',
              },
              gridLines: {
                color: 'rgba(0,0,0,0.1)',
              }
            }],
            yAxes: [{
              gridLines: {
                display: false,
              },
              ticks: {
                fontStyle: 'bold',
              }
            }]
          },
          legend: {
            display: false,
          },
          title: {
            display: true,
            text: 'Puntuaciones Directas por Factor (16PF)',
            fontSize: 16,
            fontStyle: 'bold',
            fontColor: '#1d4ed8',
          },
          plugins: {
            datalabels: {
              display: true,
              anchor: 'end',
              align: 'right',
              color: '#333',
              font: {
                weight: 'bold',
              }
            }
          }
        }
      };

      const quickChartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=600&h=500&bkg=white&f=png`;

      this.logger.log('Generating raw scores chart from QuickChart.io');

      const response = await fetch(quickChartUrl);

      if (!response.ok) {
        this.logger.error(`QuickChart API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      this.logger.log(`Raw scores chart generated successfully (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to generate raw scores chart: ${error.message}`);
      return null;
    }
  }

  /**
   * Generates a horizontal bar chart for 16PF decatipos using QuickChart.io API
   * @param scaledScores Object with factor names as keys and decatipo values (1-10)
   * @returns Buffer with PNG image data, or null if generation fails
   */
  private async generate16PFChart(scaledScores: Record<string, number>): Promise<Buffer | null> {
    try {
      const factors = Object.keys(scaledScores);
      const values = Object.values(scaledScores);

      // Color coding based on decatipo level
      const backgroundColors = values.map(v => {
        if (v <= 3) return 'rgba(239, 68, 68, 0.7)';   // Red - Low
        if (v <= 7) return 'rgba(59, 130, 246, 0.7)';  // Blue - Medium
        return 'rgba(16, 185, 129, 0.7)';              // Green - High
      });

      const borderColors = values.map(v => {
        if (v <= 3) return 'rgb(239, 68, 68)';
        if (v <= 7) return 'rgb(59, 130, 246)';
        return 'rgb(16, 185, 129)';
      });

      const chartConfig = {
        type: 'horizontalBar',
        data: {
          labels: factors,
          datasets: [{
            label: 'Decatipo',
            data: values,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1,
          }]
        },
        options: {
          indexAxis: 'y',
          scales: {
            xAxes: [{
              ticks: {
                beginAtZero: true,
                max: 10,
                stepSize: 1,
              },
              scaleLabel: {
                display: true,
                labelString: 'Decatipo (1-10)',
                fontStyle: 'bold',
              },
              gridLines: {
                color: 'rgba(0,0,0,0.1)',
              }
            }],
            yAxes: [{
              gridLines: {
                display: false,
              },
              ticks: {
                fontStyle: 'bold',
              }
            }]
          },
          legend: {
            display: false,
          },
          title: {
            display: true,
            text: 'Perfil de Personalidad 16PF - Decatipos',
            fontSize: 16,
            fontStyle: 'bold',
            fontColor: '#1d4ed8',
          },
          plugins: {
            datalabels: {
              display: true,
              anchor: 'end',
              align: 'right',
              color: '#333',
              font: {
                weight: 'bold',
              }
            }
          },
          // Add reference lines for interpretation zones
          annotation: {
            annotations: [
              {
                type: 'line',
                mode: 'vertical',
                scaleID: 'x-axis-0',
                value: 3.5,
                borderColor: 'rgba(239, 68, 68, 0.5)',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                  enabled: true,
                  content: 'Bajo',
                  position: 'top',
                }
              },
              {
                type: 'line',
                mode: 'vertical',
                scaleID: 'x-axis-0',
                value: 7.5,
                borderColor: 'rgba(16, 185, 129, 0.5)',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                  enabled: true,
                  content: 'Alto',
                  position: 'top',
                }
              }
            ]
          }
        }
      };

      const quickChartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=600&h=500&bkg=white&f=png`;

      this.logger.log('Generating 16PF chart from QuickChart.io');

      const response = await fetch(quickChartUrl);

      if (!response.ok) {
        this.logger.error(`QuickChart API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      this.logger.log(`16PF chart generated successfully (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to generate 16PF chart: ${error.message}`);
      return null;
    }
  }

  /**
   * Creates a Paragraph with an embedded chart image
   */
  private createChartParagraph(imageBuffer: Buffer, width: number = 550, height: number = 450): Paragraph {
    return new Paragraph({
      children: [
        new ImageRun({
          data: imageBuffer,
          transformation: {
            width,
            height,
          },
          type: 'png',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
    });
  }
}
