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
        sections.push(...this.createDetailedTestSection(testResponse));

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
      const status = tr.isCompleted ? '✓ Completado' : 'Pendiente';
      const statusColor = tr.isCompleted ? TALENTREE_COLORS.success : TALENTREE_COLORS.warning;

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

  private createDetailedTestSection(testResponse: TestResponse): Paragraph[] {
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

    // Raw Scores
    if (testResponse.rawScores && Object.keys(testResponse.rawScores).length > 0) {
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

    // Scaled Scores (for 16PF decatipos, etc.)
    if (testResponse.scaledScores && Object.keys(testResponse.scaledScores).length > 0) {
      sections.push(
        this.createEmptyLine(),
        new Paragraph({
          children: [new TextRun({ text: 'Puntuaciones Escaladas (Decatipos/Percentiles):', bold: true })],
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
          } else if (typeof value === 'object') {
            sections.push(
              new Paragraph({
                children: [new TextRun({ text: `  ${key}:`, bold: true })],
                spacing: { before: 100, after: 50 },
              }),
            );
            for (const [subKey, subValue] of Object.entries(value)) {
              sections.push(
                new Paragraph({
                  text: `    - ${subKey}: ${subValue}`,
                  spacing: { before: 25, after: 25 },
                  bullet: { level: 1 },
                }),
              );
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
}
