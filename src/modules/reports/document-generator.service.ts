import { Injectable, Logger } from '@nestjs/common';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  VerticalAlign,
  ImageRun,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from 'docx';
import { WorkerProcess } from '../workers/entities/worker-process.entity';
import { TestResponse } from '../test-responses/entities/test-response.entity';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Talentree brand colors (blue theme)
const COLORS = {
  primary: '2563eb',      // Azul principal Talentree
  primaryDark: '1d4ed8',  // Azul oscuro
  primaryLight: '3b82f6', // Azul claro
  background: 'eff6ff',   // Azul muy claro para fondos
  backgroundAlt: 'dbeafe', // Fondo alternativo
  text: '1f2937',         // Texto principal (gris oscuro)
  textLight: '6b7280',    // Texto secundario
  white: 'FFFFFF',
  success: '059669',      // Verde
  warning: 'd97706',      // Naranja
  danger: 'dc2626',       // Rojo
  border: 'e5e7eb',       // Borde gris claro
};

@Injectable()
export class DocumentGeneratorService {
  private readonly logger = new Logger(DocumentGeneratorService.name);
  private logoBuffer: Buffer | null = null;

  constructor() {
    this.loadLogo();
  }

  /**
   * Carga el logo de Talentree desde los assets
   */
  private loadLogo(): void {
    try {
      // Intentar múltiples rutas para desarrollo y producción
      const possiblePaths = [
        join(process.cwd(), 'src', 'assets', 'images', 'talentreelogo.png'),
        join(process.cwd(), 'dist', 'assets', 'images', 'talentreelogo.png'),
        join(__dirname, '..', '..', 'assets', 'images', 'talentreelogo.png'),
        join(__dirname, '..', '..', '..', 'assets', 'images', 'talentreelogo.png'),
      ];

      for (const logoPath of possiblePaths) {
        if (existsSync(logoPath)) {
          this.logoBuffer = readFileSync(logoPath);
          this.logger.log(`Logo cargado desde: ${logoPath}`);
          return;
        }
      }

      this.logger.warn('Logo no encontrado en ninguna ruta');
    } catch (error) {
      this.logger.error(`Error cargando logo: ${error.message}`);
    }
  }

  /**
   * Genera un reporte DOCX completo para un worker en un proceso
   */
  async generateWorkerProcessReport(workerProcess: WorkerProcess): Promise<Buffer> {
    this.logger.log(`Generando reporte para WorkerProcess ${workerProcess.id}`);

    const sections: (Paragraph | Table)[] = [];

    // ========== PORTADA ==========
    sections.push(...this.createCoverPage(workerProcess));

    // ========== INFORMACIÓN DEL CANDIDATO Y PROCESO ==========
    sections.push(
      this.createPageBreakParagraph(),
      this.createMainHeader('DATOS DEL CANDIDATO'),
      this.createCandidateTable(workerProcess),
      this.createSpacing(300),
      this.createMainHeader('DATOS DEL PROCESO'),
      this.createProcessTable(workerProcess),
    );

    // ========== RESUMEN DE EVALUACIONES ==========
    if (workerProcess.testResponses && workerProcess.testResponses.length > 0) {
      sections.push(
        this.createSpacing(400),
        this.createMainHeader('RESUMEN DE EVALUACIONES'),
        this.createTestsSummaryTable(workerProcess.testResponses),
      );
    }

    // ========== DETALLE DE CADA TEST ==========
    if (workerProcess.testResponses && workerProcess.testResponses.length > 0) {
      for (const testResponse of workerProcess.testResponses) {
        sections.push(this.createPageBreakParagraph());
        const testSections = await this.createTestDetailSection(testResponse);
        sections.push(...testSections);
      }
    }

    // ========== CONCLUSIONES ==========
    sections.push(
      this.createPageBreakParagraph(),
      this.createMainHeader('CONCLUSIONES Y RECOMENDACIONES'),
      ...this.createConclusionsSection(workerProcess),
    );

    // Crear documento
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 720,    // 0.5 pulgadas
                right: 720,
                bottom: 720,
                left: 720,
              },
            },
          },
          headers: {
            default: this.createDocumentHeader(),
          },
          footers: {
            default: this.createDocumentFooter(),
          },
          children: sections,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    this.logger.log(`Reporte generado: ${buffer.length} bytes`);
    return buffer;
  }

  // ========== PORTADA ==========

  private createCoverPage(workerProcess: WorkerProcess): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = [];
    const worker = workerProcess.worker;
    const process = workerProcess.process;

    // Espaciado inicial
    elements.push(this.createSpacing(600));

    // Logo centrado
    if (this.logoBuffer) {
      elements.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: this.logoBuffer,
              transformation: { width: 130, height: 124 },
              type: 'png',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
        }),
      );
    }

    // Título principal
    elements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'INFORME DE',
            bold: true,
            size: 48,
            color: COLORS.primary,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'EVALUACIÓN PSICOTÉCNICA',
            bold: true,
            size: 48,
            color: COLORS.primary,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 800 },
      }),
    );

    // Línea decorativa
    elements.push(
      new Paragraph({
        border: {
          bottom: { color: COLORS.primary, size: 30, style: BorderStyle.SINGLE, space: 1 },
        },
        spacing: { after: 800 },
      }),
    );

    // Información del candidato en portada
    elements.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'CANDIDATO', bold: true, size: 28, color: COLORS.textLight }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: worker ? `${worker.firstName} ${worker.lastName}`.toUpperCase() : 'N/A',
            bold: true,
            size: 40,
            color: COLORS.text,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `RUT: ${worker?.rut || 'N/A'}`, size: 24, color: COLORS.textLight }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
      }),
    );

    // Proceso
    elements.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'PROCESO DE SELECCIÓN', bold: true, size: 28, color: COLORS.textLight }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: process?.name || 'N/A',
            bold: true,
            size: 32,
            color: COLORS.primaryDark,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: process?.company?.name || 'N/A',
            size: 26,
            color: COLORS.text,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 800 },
      }),
    );

    // Fecha
    const fechaGeneracion = new Date().toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    elements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Fecha de generación: ${fechaGeneracion}`,
            size: 22,
            color: COLORS.textLight,
            italics: true,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
      }),
    );

    return elements;
  }

  // ========== HEADERS Y FOOTERS ==========

  private createDocumentHeader(): Header {
    const children: Paragraph[] = [];

    if (this.logoBuffer) {
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: this.logoBuffer,
              transformation: { width: 60, height: 57 },
              type: 'png',
            }),
          ],
          alignment: AlignmentType.RIGHT,
          border: {
            bottom: { color: COLORS.border, size: 6, style: BorderStyle.SINGLE, space: 4 },
          },
        }),
      );
    }

    return new Header({ children });
  }

  private createDocumentFooter(): Footer {
    return new Footer({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: 'Talentree - Sistema de Gestión de Talento | Página ',
              size: 18,
              color: COLORS.textLight,
            }),
            new TextRun({
              children: [PageNumber.CURRENT],
              size: 18,
              color: COLORS.textLight,
            }),
            new TextRun({
              text: ' de ',
              size: 18,
              color: COLORS.textLight,
            }),
            new TextRun({
              children: [PageNumber.TOTAL_PAGES],
              size: 18,
              color: COLORS.textLight,
            }),
          ],
          alignment: AlignmentType.CENTER,
          border: {
            top: { color: COLORS.border, size: 6, style: BorderStyle.SINGLE, space: 4 },
          },
        }),
      ],
    });
  }

  // ========== ELEMENTOS DE FORMATO ==========

  private createMainHeader(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: `  ${text}`,
          bold: true,
          size: 26,
          color: COLORS.white,
        }),
      ],
      shading: { type: ShadingType.SOLID, color: COLORS.primary },
      spacing: { before: 300, after: 200 },
    });
  }

  private createSubHeader(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: text,
          bold: true,
          size: 24,
          color: COLORS.primaryDark,
        }),
      ],
      spacing: { before: 300, after: 150 },
      border: {
        bottom: { color: COLORS.primaryLight, size: 10, style: BorderStyle.SINGLE, space: 4 },
      },
    });
  }

  private createSpacing(space: number): Paragraph {
    return new Paragraph({ spacing: { after: space } });
  }

  private createPageBreakParagraph(): Paragraph {
    return new Paragraph({ children: [new PageBreak()] });
  }

  // ========== TABLAS DE INFORMACIÓN ==========

  private createCandidateTable(workerProcess: WorkerProcess): Table {
    const worker = workerProcess.worker;
    return this.createInfoTable([
      ['Nombre Completo', worker ? `${worker.firstName} ${worker.lastName}` : 'N/A'],
      ['RUT', worker?.rut || 'N/A'],
      ['Email', worker?.email || 'N/A'],
      ['Teléfono', worker?.phone || 'N/A'],
      ['Fecha de Postulación', workerProcess.appliedAt
        ? new Date(workerProcess.appliedAt).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'N/A'],
    ]);
  }

  private createProcessTable(workerProcess: WorkerProcess): Table {
    const process = workerProcess.process;
    return this.createInfoTable([
      ['Proceso', process?.name || 'N/A'],
      ['Empresa', process?.company?.name || 'N/A'],
      ['Estado', this.translateStatus(workerProcess.status)],
      ['Fecha de Evaluación', workerProcess.evaluatedAt
        ? new Date(workerProcess.evaluatedAt).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'Pendiente'],
    ]);
  }

  private createInfoTable(rows: [string, string][]): Table {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
        left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
        right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
        insideVertical: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
      },
      rows: rows.map(([label, value], index) =>
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: label, bold: true, size: 22, color: COLORS.primaryDark })],
                spacing: { before: 80, after: 80 },
              })],
              width: { size: 30, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.SOLID, color: index % 2 === 0 ? COLORS.background : COLORS.backgroundAlt },
              verticalAlign: VerticalAlign.CENTER,
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: value, size: 22, color: COLORS.text })],
                spacing: { before: 80, after: 80 },
              })],
              width: { size: 70, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.SOLID, color: index % 2 === 0 ? COLORS.background : COLORS.backgroundAlt },
              verticalAlign: VerticalAlign.CENTER,
            }),
          ],
        }),
      ),
    });
  }

  // ========== TABLA RESUMEN DE TESTS ==========

  private createTestsSummaryTable(testResponses: TestResponse[]): Table {
    const headerRow = new TableRow({
      tableHeader: true,
      children: ['Evaluación', 'Estado', 'Fecha', 'Resultado'].map(text =>
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text, bold: true, size: 20, color: COLORS.white })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 100 },
          })],
          shading: { type: ShadingType.SOLID, color: COLORS.primaryDark },
          verticalAlign: VerticalAlign.CENTER,
        }),
      ),
    });

    const dataRows = testResponses.map((tr, index) => {
      const testName = tr.fixedTest?.name || tr.test?.name || 'Test';

      let status = 'Pendiente';
      let statusColor = COLORS.warning;
      if (tr.status === 'completed' || tr.isCompleted) {
        status = 'Completado';
        statusColor = COLORS.success;
      } else if (tr.status === 'insufficient_answers') {
        status = 'Incompleto';
        statusColor = COLORS.danger;
      }

      const fecha = tr.completedAt
        ? new Date(tr.completedAt).toLocaleDateString('es-CL')
        : '-';

      let resultado = '-';
      if (tr.interpretation?.nivel) {
        resultado = tr.interpretation.nivel;
      } else if (tr.interpretation?.nivelGlobal) {
        resultado = tr.interpretation.nivelGlobal;
      } else if (tr.interpretation?.perfilPredominante) {
        resultado = `Perfil ${tr.interpretation.perfilPredominante}`;
      } else if (tr.score !== null && tr.maxScore !== null) {
        resultado = `${Math.round((tr.score / tr.maxScore) * 100)}%`;
      }

      const bgColor = index % 2 === 0 ? COLORS.white : COLORS.background;

      return new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: testName, size: 20 })],
              spacing: { before: 80, after: 80 },
            })],
            shading: { type: ShadingType.SOLID, color: bgColor },
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: status, size: 20, color: statusColor, bold: true })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, after: 80 },
            })],
            shading: { type: ShadingType.SOLID, color: bgColor },
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: fecha, size: 20 })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, after: 80 },
            })],
            shading: { type: ShadingType.SOLID, color: bgColor },
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: resultado, size: 20, bold: true })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, after: 80 },
            })],
            shading: { type: ShadingType.SOLID, color: bgColor },
          }),
        ],
      });
    });

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    });
  }

  // ========== SECCIÓN DETALLE DE CADA TEST ==========

  private async createTestDetailSection(testResponse: TestResponse): Promise<(Paragraph | Table)[]> {
    const sections: (Paragraph | Table)[] = [];
    const testName = testResponse.fixedTest?.name || testResponse.test?.name || 'Test';
    const testCode = testResponse.fixedTest?.code || '';

    // Header del test
    sections.push(this.createMainHeader(testName.toUpperCase()));

    // Test incompleto
    if (testResponse.status === 'insufficient_answers') {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'TEST NO COMPLETADO', bold: true, size: 26, color: COLORS.danger }),
          ],
          spacing: { before: 200, after: 200 },
          shading: { type: ShadingType.SOLID, color: 'fee2e2' },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `El candidato no completó esta evaluación. ${
                (testResponse.metadata as any)?.answeredQuestions !== undefined
                  ? `Se respondieron ${(testResponse.metadata as any).answeredQuestions} de ${(testResponse.metadata as any).totalQuestions} preguntas.`
                  : ''
              }`,
              size: 22,
            }),
          ],
          spacing: { after: 200 },
        }),
      );
      return sections;
    }

    // Descripción del test
    const description = testResponse.fixedTest?.description || testResponse.test?.description;
    if (description) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Descripción: ', bold: true, size: 22 }),
            new TextRun({ text: description, size: 22, italics: true, color: COLORS.textLight }),
          ],
          spacing: { before: 150, after: 200 },
        }),
      );
    }

    // Fechas
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Fecha de realización: ', bold: true, size: 20 }),
          new TextRun({
            text: testResponse.completedAt
              ? new Date(testResponse.completedAt).toLocaleDateString('es-CL', {
                  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })
              : 'No completado',
            size: 20,
          }),
        ],
        spacing: { after: 200 },
      }),
    );

    // Renderizar según el tipo de test
    switch (testCode) {
      case 'TEST_16PF':
        sections.push(...await this.render16PFSection(testResponse));
        break;
      case 'TEST_DISC':
        sections.push(...await this.renderDISCSection(testResponse));
        break;
      case 'TEST_CFR':
        sections.push(...await this.renderCFRSection(testResponse));
        break;
      case 'TEST_IL':
        sections.push(...await this.renderILSection(testResponse));
        break;
      case 'TEST_IC':
        sections.push(...await this.renderICSection(testResponse));
        break;
      case 'TEST_TAC':
        sections.push(...await this.renderTACSection(testResponse));
        break;
      default:
        sections.push(...this.renderGenericSection(testResponse));
    }

    return sections;
  }

  // ========== SECCIÓN 16PF ==========

  private async render16PFSection(testResponse: TestResponse): Promise<(Paragraph | Table)[]> {
    const sections: (Paragraph | Table)[] = [];

    // Gráfico de Puntuaciones Directas
    if (testResponse.rawScores && Object.keys(testResponse.rawScores).length > 0) {
      try {
        const rawChartBuffer = await this.generateBarChart(
          testResponse.rawScores as Record<string, number>,
          'Puntuaciones Directas por Factor (PD)',
          COLORS.primaryLight,
        );
        if (rawChartBuffer) {
          sections.push(
            this.createSubHeader('Puntuaciones Directas'),
            this.createChartParagraph(rawChartBuffer),
          );
        }
      } catch (error) {
        this.logger.warn(`Error generando gráfico PD: ${error.message}`);
      }
    }

    // Gráfico de Decatipos
    if (testResponse.scaledScores && Object.keys(testResponse.scaledScores).length > 0) {
      try {
        const chartBuffer = await this.generate16PFDecatiposChart(testResponse.scaledScores as Record<string, number>);
        if (chartBuffer) {
          sections.push(
            this.createSubHeader('Perfil de Personalidad - Decatipos'),
            this.createChartParagraph(chartBuffer),
            new Paragraph({
              children: [
                new TextRun({ text: 'Interpretación: ', bold: true, size: 18 }),
                new TextRun({ text: '1-3 Bajo (rojo) | 4-7 Medio (azul) | 8-10 Alto (verde)', size: 18, color: COLORS.textLight }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 },
            }),
          );
        }
      } catch (error) {
        this.logger.warn(`Error generando gráfico decatipos: ${error.message}`);
      }
    }

    // Descripción de factores
    if (testResponse.interpretation?.factorDescriptions) {
      sections.push(this.createSubHeader('Descripción de Factores'));
      sections.push(this.create16PFFactorsTable(testResponse.interpretation.factorDescriptions));
    }

    // Resumen y recomendaciones
    if (testResponse.interpretation?.resumenGlobal) {
      sections.push(
        this.createSubHeader('Resumen Global'),
        new Paragraph({
          children: [new TextRun({ text: testResponse.interpretation.resumenGlobal, size: 22 })],
          spacing: { after: 200 },
        }),
      );
    }

    if (testResponse.interpretation?.recomendaciones?.length > 0) {
      sections.push(this.createSubHeader('Recomendaciones'));
      for (const rec of testResponse.interpretation.recomendaciones) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: `• ${rec}`, size: 20 })],
            spacing: { before: 50, after: 50 },
          }),
        );
      }
    }

    return sections;
  }

  private create16PFFactorsTable(factorDescriptions: Record<string, any>): Table {
    const headerRow = new TableRow({
      tableHeader: true,
      children: ['Factor', 'DT', 'Nivel', 'Descripción'].map(text =>
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text, bold: true, size: 18, color: COLORS.white })],
            alignment: AlignmentType.CENTER,
          })],
          shading: { type: ShadingType.SOLID, color: COLORS.primaryDark },
        }),
      ),
    });

    const dataRows = Object.entries(factorDescriptions).map(([factor, data]: [string, any], index) => {
      const nivelColor = data.nivel === 'BAJO' ? COLORS.danger : data.nivel === 'ALTO' ? COLORS.success : COLORS.primary;
      const bgColor = index % 2 === 0 ? COLORS.white : COLORS.background;

      return new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: factor, bold: true, size: 18 })],
              alignment: AlignmentType.CENTER,
            })],
            shading: { type: ShadingType.SOLID, color: bgColor },
            width: { size: 10, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: String(data.decatipo || '-'), size: 18, bold: true })],
              alignment: AlignmentType.CENTER,
            })],
            shading: { type: ShadingType.SOLID, color: bgColor },
            width: { size: 10, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: data.nivel || '-', size: 18, color: nivelColor, bold: true })],
              alignment: AlignmentType.CENTER,
            })],
            shading: { type: ShadingType.SOLID, color: bgColor },
            width: { size: 15, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: data.descripcion || '-', size: 16 })],
            })],
            shading: { type: ShadingType.SOLID, color: bgColor },
            width: { size: 65, type: WidthType.PERCENTAGE },
          }),
        ],
      });
    });

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    });
  }

  // ========== SECCIÓN DISC ==========

  private async renderDISCSection(testResponse: TestResponse): Promise<(Paragraph | Table)[]> {
    const sections: (Paragraph | Table)[] = [];
    const interp = testResponse.interpretation;

    // Gráfico DISC
    if (testResponse.scaledScores) {
      try {
        const chartBuffer = await this.generateDISCChart(testResponse.scaledScores as Record<string, number>);
        if (chartBuffer) {
          sections.push(
            this.createSubHeader('Perfil DISC'),
            this.createChartParagraph(chartBuffer, 500, 350),
          );
        }
      } catch (error) {
        this.logger.warn(`Error generando gráfico DISC: ${error.message}`);
      }
    }

    // Perfil
    if (interp?.perfilPredominante) {
      sections.push(
        this.createSubHeader('Resultado del Perfil'),
        new Paragraph({
          children: [
            new TextRun({ text: 'Perfil Predominante: ', bold: true, size: 24 }),
            new TextRun({ text: interp.perfilPredominante, size: 24, bold: true, color: COLORS.primary }),
            new TextRun({ text: `  (Combinado: ${interp.perfilCombinado || 'N/A'})`, size: 22, color: COLORS.textLight }),
          ],
          spacing: { after: 200 },
        }),
      );

      if (interp.descripcion) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: interp.descripcion, size: 22 })],
            spacing: { after: 300 },
          }),
        );
      }
    }

    // Estilos por dimensión
    if (interp?.estiloNatural) {
      sections.push(this.createSubHeader('Estilo Natural por Dimensión'));
      const dimensionNames: Record<string, string> = {
        D: 'Dominancia', I: 'Influencia', S: 'Estabilidad', C: 'Cumplimiento',
      };
      for (const [dim, desc] of Object.entries(interp.estiloNatural)) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${dimensionNames[dim] || dim}: `, bold: true, size: 20 }),
              new TextRun({ text: desc as string, size: 20 }),
            ],
            spacing: { before: 50, after: 50 },
          }),
        );
      }
    }

    // Fortalezas
    if (interp?.fortalezas?.length > 0) {
      sections.push(this.createSubHeader('Fortalezas'));
      for (const f of interp.fortalezas) {
        sections.push(new Paragraph({
          children: [new TextRun({ text: `• ${f}`, size: 20 })],
          spacing: { before: 30, after: 30 },
        }));
      }
    }

    // Áreas de desarrollo
    if (interp?.areasDeDesarrollo?.length > 0) {
      sections.push(this.createSubHeader('Áreas de Desarrollo'));
      for (const a of interp.areasDeDesarrollo) {
        sections.push(new Paragraph({
          children: [new TextRun({ text: `• ${a}`, size: 20 })],
          spacing: { before: 30, after: 30 },
        }));
      }
    }

    return sections;
  }

  // ========== SECCIÓN CFR ==========

  private async renderCFRSection(testResponse: TestResponse): Promise<(Paragraph | Table)[]> {
    const sections: (Paragraph | Table)[] = [];
    const interp = testResponse.interpretation;
    const score = testResponse.rawScores?.total || 0;

    // Indicador visual de riesgo
    sections.push(
      this.createSubHeader('Nivel de Riesgo'),
      await this.createRiskIndicator(score as number, interp?.nivel, interp?.riesgo),
    );

    // Puntuación
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Puntuación Total: ', bold: true, size: 24 }),
          new TextRun({ text: `${score} / 300`, size: 24, bold: true, color: this.getCFRColor(interp?.nivel) }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 300, after: 300 },
      }),
    );

    // Descripción
    if (interp?.descripcion) {
      sections.push(
        this.createSubHeader('Interpretación'),
        new Paragraph({
          children: [new TextRun({ text: interp.descripcion, size: 22 })],
          spacing: { after: 200 },
        }),
      );
    }

    // Aptitud
    if (interp) {
      sections.push(
        this.createSubHeader('Aptitud para Roles Críticos'),
        this.createCFRAptitudTable(interp),
      );
    }

    // Recomendación
    if (interp?.recomendacion) {
      sections.push(
        this.createSubHeader('Recomendación'),
        new Paragraph({
          children: [new TextRun({ text: interp.recomendacion, size: 22 })],
          spacing: { after: 200 },
          shading: { type: ShadingType.SOLID, color: interp.alertLevel === 'danger' ? 'fee2e2' : interp.alertLevel === 'warning' ? 'fef3c7' : 'd1fae5' },
        }),
      );
    }

    return sections;
  }

  private async createRiskIndicator(score: number, nivel?: string, riesgo?: string): Promise<Table> {
    // Crear una barra visual de riesgo
    const percentage = Math.min(100, Math.max(0, ((score - 60) / 240) * 100));
    const barColor = nivel === 'BAJO' ? COLORS.success : nivel === 'ALTO' ? COLORS.danger : COLORS.warning;

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: `${riesgo || nivel || 'N/A'}`, bold: true, size: 28, color: barColor })],
                alignment: AlignmentType.CENTER,
                spacing: { before: 150, after: 150 },
              })],
              shading: { type: ShadingType.SOLID, color: COLORS.background },
              columnSpan: 3,
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: 'PRUDENTE', size: 16, color: COLORS.success })],
                alignment: AlignmentType.CENTER,
              })],
              shading: { type: ShadingType.SOLID, color: 'd1fae5' },
              width: { size: 33, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: 'MODERADO', size: 16, color: COLORS.warning })],
                alignment: AlignmentType.CENTER,
              })],
              shading: { type: ShadingType.SOLID, color: 'fef3c7' },
              width: { size: 34, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: 'IMPULSIVO', size: 16, color: COLORS.danger })],
                alignment: AlignmentType.CENTER,
              })],
              shading: { type: ShadingType.SOLID, color: 'fee2e2' },
              width: { size: 33, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
      ],
    });
  }

  private createCFRAptitudTable(interp: any): Table {
    const rows = [
      ['Apto para Seguridad', interp.esAptoParaSeguridad ? 'SÍ' : 'NO', interp.esAptoParaSeguridad ? COLORS.success : COLORS.danger],
      ['Apto para Operación Crítica', interp.esAptoParaOperacionCritica ? 'SÍ' : 'NO', interp.esAptoParaOperacionCritica ? COLORS.success : COLORS.danger],
      ['Requiere Capacitación', interp.requiereCapacitacion ? 'SÍ' : 'NO', interp.requiereCapacitacion ? COLORS.warning : COLORS.success],
    ];

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows.map(([label, value, color], index) =>
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: label as string, bold: true, size: 20 })],
                spacing: { before: 80, after: 80 },
              })],
              shading: { type: ShadingType.SOLID, color: index % 2 === 0 ? COLORS.background : COLORS.white },
              width: { size: 60, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: value as string, bold: true, size: 20, color: color as string })],
                alignment: AlignmentType.CENTER,
                spacing: { before: 80, after: 80 },
              })],
              shading: { type: ShadingType.SOLID, color: index % 2 === 0 ? COLORS.background : COLORS.white },
              width: { size: 40, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
      ),
    });
  }

  private getCFRColor(nivel?: string): string {
    if (nivel === 'BAJO') return COLORS.success;
    if (nivel === 'ALTO') return COLORS.danger;
    return COLORS.warning;
  }

  // ========== SECCIÓN IL (WONDERLIC) ==========

  private async renderILSection(testResponse: TestResponse): Promise<(Paragraph | Table)[]> {
    const sections: (Paragraph | Table)[] = [];
    const interp = testResponse.interpretation;
    const score = testResponse.rawScores?.total || 0;
    const percentage = testResponse.scaledScores?.percentage || 0;

    // Puntuación
    const nivelColor = interp?.nivel === 'ALTO' ? COLORS.success : interp?.nivel === 'BAJO' ? COLORS.danger : COLORS.warning;

    sections.push(
      this.createSubHeader('Resultado'),
      new Paragraph({
        children: [
          new TextRun({ text: 'Puntuación: ', bold: true, size: 28 }),
          new TextRun({ text: `${score} / 20`, size: 28, bold: true, color: COLORS.primary }),
          new TextRun({ text: `  (${percentage}%)`, size: 24, color: COLORS.textLight }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 150 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Nivel: ', bold: true, size: 24 }),
          new TextRun({ text: interp?.nivel || 'N/A', size: 24, bold: true, color: nivelColor }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
      }),
    );

    // Descripción
    if (interp?.descripcion) {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: interp.descripcion, size: 22 })],
          spacing: { after: 200 },
        }),
      );
    }

    // Capacidades
    if (interp?.capacidades?.length > 0) {
      sections.push(this.createSubHeader('Capacidades Identificadas'));
      for (const cap of interp.capacidades) {
        sections.push(new Paragraph({
          children: [new TextRun({ text: `• ${cap}`, size: 20 })],
          spacing: { before: 30, after: 30 },
        }));
      }
    }

    // Recomendaciones
    if (interp?.recomendaciones?.length > 0) {
      sections.push(this.createSubHeader('Recomendaciones'));
      for (const rec of interp.recomendaciones) {
        sections.push(new Paragraph({
          children: [new TextRun({ text: `• ${rec}`, size: 20 })],
          spacing: { before: 30, after: 30 },
        }));
      }
    }

    return sections;
  }

  // ========== SECCIÓN IC ==========

  private async renderICSection(testResponse: TestResponse): Promise<(Paragraph | Table)[]> {
    const sections: (Paragraph | Table)[] = [];
    const interp = testResponse.interpretation;
    const rawScores = testResponse.rawScores as any;
    const percentage = testResponse.scaledScores?.percentage || 0;

    // Puntuación
    const nivelColor = this.getICColor(interp?.nivel);

    sections.push(
      this.createSubHeader('Resultado'),
      new Paragraph({
        children: [
          new TextRun({ text: 'Puntuación: ', bold: true, size: 28 }),
          new TextRun({ text: `${rawScores?.total || 0} / 20`, size: 28, bold: true, color: COLORS.primary }),
          new TextRun({ text: `  (${percentage}%)`, size: 24, color: COLORS.textLight }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 150 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Nivel: ', bold: true, size: 24 }),
          new TextRun({ text: interp?.nivel?.replace('_', ' ') || 'N/A', size: 24, bold: true, color: nivelColor }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
      }),
    );

    // Detalle por columna
    if (rawScores?.column1 !== undefined) {
      sections.push(
        this.createSubHeader('Detalle por Instrucción'),
        this.createInfoTable([
          ['Instrucción 1', `${rawScores.column1} aciertos`],
          ['Instrucción 2', `${rawScores.column2} aciertos`],
          ['Instrucción 3', `${rawScores.column3} aciertos`],
        ]),
      );
    }

    // Descripción
    if (interp?.descripcion) {
      sections.push(
        this.createSpacing(200),
        new Paragraph({
          children: [new TextRun({ text: interp.descripcion, size: 22 })],
          spacing: { after: 200 },
        }),
      );
    }

    // Capacidades y recomendaciones
    if (interp?.capacidades?.length > 0) {
      sections.push(this.createSubHeader('Capacidades Identificadas'));
      for (const cap of interp.capacidades) {
        sections.push(new Paragraph({
          children: [new TextRun({ text: `• ${cap}`, size: 20 })],
          spacing: { before: 30, after: 30 },
        }));
      }
    }

    if (interp?.recomendaciones?.length > 0) {
      sections.push(this.createSubHeader('Recomendaciones'));
      for (const rec of interp.recomendaciones) {
        sections.push(new Paragraph({
          children: [new TextRun({ text: `• ${rec}`, size: 20 })],
          spacing: { before: 30, after: 30 },
        }));
      }
    }

    return sections;
  }

  private getICColor(nivel?: string): string {
    if (nivel === 'MUY_ALTO' || nivel === 'ALTO') return COLORS.success;
    if (nivel === 'MUY_BAJO' || nivel === 'BAJO') return COLORS.danger;
    return COLORS.warning;
  }

  // ========== SECCIÓN TAC ==========

  private async renderTACSection(testResponse: TestResponse): Promise<(Paragraph | Table)[]> {
    const sections: (Paragraph | Table)[] = [];
    const interp = testResponse.interpretation;
    const scaledScores = testResponse.scaledScores as any;

    // Gráfico radar de TAC
    if (scaledScores) {
      try {
        const chartBuffer = await this.generateTACRadarChart(scaledScores);
        if (chartBuffer) {
          sections.push(
            this.createSubHeader('Perfil de Competencias'),
            this.createChartParagraph(chartBuffer, 450, 350),
          );
        }
      } catch (error) {
        this.logger.warn(`Error generando gráfico TAC: ${error.message}`);
      }
    }

    // Puntuación global
    const nivelColor = this.getTACColor(interp?.nivelGlobal);
    sections.push(
      this.createSubHeader('Resultado Global'),
      new Paragraph({
        children: [
          new TextRun({ text: 'Puntuación Global: ', bold: true, size: 28 }),
          new TextRun({ text: `${scaledScores?.global?.toFixed(2) || 'N/A'} / 5.0`, size: 28, bold: true, color: COLORS.primary }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 150 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Nivel: ', bold: true, size: 24 }),
          new TextRun({ text: interp?.nivelGlobal?.replace('_', ' ') || 'N/A', size: 24, bold: true, color: nivelColor }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
    );

    if (interp?.descripcionGlobal) {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: interp.descripcionGlobal, size: 22 })],
          spacing: { after: 300 },
        }),
      );
    }

    // Tabla de dimensiones
    if (interp?.dimensiones) {
      sections.push(
        this.createSubHeader('Detalle por Dimensión'),
        this.createTACDimensionsTable(interp.dimensiones),
      );
    }

    // Fortalezas y áreas de desarrollo
    if (interp?.fortalezas?.length > 0) {
      sections.push(this.createSubHeader('Fortalezas'));
      for (const f of interp.fortalezas) {
        sections.push(new Paragraph({
          children: [new TextRun({ text: `• ${f}`, size: 20, color: COLORS.success })],
          spacing: { before: 30, after: 30 },
        }));
      }
    }

    if (interp?.areasDeDesarrollo?.length > 0) {
      sections.push(this.createSubHeader('Áreas de Desarrollo'));
      for (const a of interp.areasDeDesarrollo) {
        sections.push(new Paragraph({
          children: [new TextRun({ text: `• ${a}`, size: 20, color: COLORS.warning })],
          spacing: { before: 30, after: 30 },
        }));
      }
    }

    // Recomendaciones
    if (interp?.recomendaciones?.length > 0) {
      sections.push(this.createSubHeader('Recomendaciones'));
      for (const rec of interp.recomendaciones) {
        sections.push(new Paragraph({
          children: [new TextRun({ text: `• ${rec}`, size: 20 })],
          spacing: { before: 30, after: 30 },
        }));
      }
    }

    return sections;
  }

  private createTACDimensionsTable(dimensiones: Record<string, any>): Table {
    const headerRow = new TableRow({
      tableHeader: true,
      children: ['Dimensión', 'Promedio', 'Nivel', 'Descripción'].map(text =>
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text, bold: true, size: 18, color: COLORS.white })],
            alignment: AlignmentType.CENTER,
          })],
          shading: { type: ShadingType.SOLID, color: COLORS.primaryDark },
        }),
      ),
    });

    const dataRows = Object.entries(dimensiones).map(([key, data]: [string, any], index) => {
      const nivelColor = this.getDimensionLevelColor(data.nivel);
      const bgColor = index % 2 === 0 ? COLORS.white : COLORS.background;

      return new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: data.nombre || key, bold: true, size: 16 })],
            })],
            shading: { type: ShadingType.SOLID, color: bgColor },
            width: { size: 25, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: data.promedio?.toFixed(2) || '-', size: 16, bold: true })],
              alignment: AlignmentType.CENTER,
            })],
            shading: { type: ShadingType.SOLID, color: bgColor },
            width: { size: 15, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: data.nivel || '-', size: 16, color: nivelColor, bold: true })],
              alignment: AlignmentType.CENTER,
            })],
            shading: { type: ShadingType.SOLID, color: bgColor },
            width: { size: 15, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: data.descripcion || '-', size: 14 })],
            })],
            shading: { type: ShadingType.SOLID, color: bgColor },
            width: { size: 45, type: WidthType.PERCENTAGE },
          }),
        ],
      });
    });

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    });
  }

  private getTACColor(nivel?: string): string {
    if (nivel === 'EXCELENTE') return COLORS.success;
    if (nivel === 'REQUIERE_MEJORA') return COLORS.danger;
    if (nivel === 'EN_DESARROLLO') return COLORS.warning;
    return COLORS.primary;
  }

  private getDimensionLevelColor(nivel?: string): string {
    if (['Excelente', 'Muy Bueno'].includes(nivel || '')) return COLORS.success;
    if (['Deficiente', 'Requiere Atención'].includes(nivel || '')) return COLORS.danger;
    if (['En Desarrollo'].includes(nivel || '')) return COLORS.warning;
    return COLORS.text;
  }

  // ========== SECCIÓN GENÉRICA ==========

  private renderGenericSection(testResponse: TestResponse): (Paragraph | Table)[] {
    const sections: (Paragraph | Table)[] = [];

    // Puntuación
    if (testResponse.score !== null && testResponse.maxScore !== null) {
      const percentage = Math.round((testResponse.score / testResponse.maxScore) * 100);
      sections.push(
        this.createSubHeader('Resultado'),
        new Paragraph({
          children: [
            new TextRun({ text: 'Puntuación: ', bold: true, size: 24 }),
            new TextRun({ text: `${testResponse.score} / ${testResponse.maxScore} (${percentage}%)`, size: 24, color: COLORS.primary }),
          ],
          spacing: { after: 200 },
        }),
      );
    }

    // Interpretación genérica
    if (testResponse.interpretation) {
      sections.push(this.createSubHeader('Interpretación'));
      if (typeof testResponse.interpretation === 'string') {
        sections.push(new Paragraph({
          children: [new TextRun({ text: testResponse.interpretation, size: 22 })],
          spacing: { after: 200 },
        }));
      } else {
        for (const [key, value] of Object.entries(testResponse.interpretation)) {
          if (typeof value === 'string') {
            sections.push(new Paragraph({
              children: [
                new TextRun({ text: `${key}: `, bold: true, size: 20 }),
                new TextRun({ text: value, size: 20 }),
              ],
              spacing: { before: 50, after: 50 },
            }));
          }
        }
      }
    }

    return sections;
  }

  // ========== CONCLUSIONES ==========

  private createConclusionsSection(workerProcess: WorkerProcess): (Paragraph | Table)[] {
    const sections: (Paragraph | Table)[] = [];

    const completedTests = workerProcess.testResponses?.filter(tr => tr.isCompleted || tr.status === 'completed').length || 0;
    const totalTests = workerProcess.testResponses?.length || 0;

    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Se completaron ${completedTests} de ${totalTests} evaluaciones asignadas.`,
            size: 24,
          }),
        ],
        spacing: { before: 200, after: 300 },
      }),
    );

    // Hallazgos clave
    const keyFindings: string[] = [];
    workerProcess.testResponses?.forEach(tr => {
      if (tr.interpretation) {
        const testName = tr.fixedTest?.name || tr.test?.name || 'Test';
        if (tr.interpretation.nivel) {
          keyFindings.push(`${testName}: Nivel ${tr.interpretation.nivel}`);
        } else if (tr.interpretation.nivelGlobal) {
          keyFindings.push(`${testName}: ${tr.interpretation.nivelGlobal.replace('_', ' ')}`);
        } else if (tr.interpretation.perfilPredominante) {
          keyFindings.push(`${testName}: Perfil ${tr.interpretation.perfilPredominante}`);
        }
      }
    });

    if (keyFindings.length > 0) {
      sections.push(this.createSubHeader('Resumen de Resultados'));
      for (const finding of keyFindings) {
        sections.push(new Paragraph({
          children: [new TextRun({ text: `• ${finding}`, size: 22 })],
          spacing: { before: 50, after: 50 },
        }));
      }
    }

    // Notas del evaluador
    if (workerProcess.notes) {
      sections.push(
        this.createSubHeader('Observaciones del Evaluador'),
        new Paragraph({
          children: [new TextRun({ text: workerProcess.notes, size: 22 })],
          spacing: { after: 200 },
        }),
      );
    }

    // Nota final
    sections.push(
      this.createSpacing(400),
      new Paragraph({
        children: [
          new TextRun({
            text: 'Nota: Este reporte es un documento editable. Los evaluadores pueden modificar y agregar observaciones adicionales según sea necesario.',
            size: 18,
            color: COLORS.textLight,
            italics: true,
          }),
        ],
        spacing: { before: 200 },
        border: { top: { color: COLORS.border, size: 6, style: BorderStyle.SINGLE, space: 8 } },
      }),
    );

    return sections;
  }

  // ========== GENERACIÓN DE GRÁFICOS ==========

  private async generateBarChart(data: Record<string, number>, title: string, color: string): Promise<Buffer | null> {
    try {
      const labels = Object.keys(data);
      const values = Object.values(data);

      const chartConfig = {
        type: 'horizontalBar',
        data: {
          labels,
          datasets: [{
            label: title,
            data: values,
            backgroundColor: `#${color}`,
            borderColor: `#${color}`,
            borderWidth: 1,
          }],
        },
        options: {
          indexAxis: 'y',
          scales: {
            xAxes: [{ ticks: { beginAtZero: true }, gridLines: { color: 'rgba(0,0,0,0.1)' } }],
            yAxes: [{ gridLines: { display: false }, ticks: { fontStyle: 'bold' } }],
          },
          legend: { display: false },
          title: { display: true, text: title, fontSize: 14, fontStyle: 'bold', fontColor: `#${COLORS.primaryDark}` },
        },
      };

      const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=550&h=400&bkg=white&f=png`;
      const response = await fetch(url);
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      this.logger.error(`Error generando gráfico de barras: ${error.message}`);
      return null;
    }
  }

  private async generate16PFDecatiposChart(scaledScores: Record<string, number>): Promise<Buffer | null> {
    try {
      const labels = Object.keys(scaledScores);
      const values = Object.values(scaledScores);

      const backgroundColors = values.map(v => {
        if (v <= 3) return '#dc2626';  // Rojo
        if (v >= 8) return '#059669';  // Verde
        return '#2563eb';              // Azul
      });

      const chartConfig = {
        type: 'horizontalBar',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: backgroundColors,
            borderWidth: 0,
          }],
        },
        options: {
          indexAxis: 'y',
          scales: {
            xAxes: [{
              ticks: { beginAtZero: true, max: 10, stepSize: 1 },
              gridLines: { color: 'rgba(0,0,0,0.1)' },
              scaleLabel: { display: true, labelString: 'Decatipo', fontStyle: 'bold' },
            }],
            yAxes: [{ gridLines: { display: false }, ticks: { fontStyle: 'bold' } }],
          },
          legend: { display: false },
          title: { display: true, text: 'Perfil de Personalidad 16PF - Decatipos', fontSize: 14, fontStyle: 'bold', fontColor: `#${COLORS.primaryDark}` },
          plugins: { datalabels: { display: true, anchor: 'end', align: 'right', color: '#333', font: { weight: 'bold' } } },
        },
      };

      const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=550&h=450&bkg=white&f=png`;
      const response = await fetch(url);
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      this.logger.error(`Error generando gráfico 16PF: ${error.message}`);
      return null;
    }
  }

  private async generateDISCChart(scaledScores: Record<string, number>): Promise<Buffer | null> {
    try {
      const dimensions = ['D', 'I', 'S', 'C'];
      const fullNames = ['Dominancia', 'Influencia', 'Estabilidad', 'Cumplimiento'];
      const colors = ['#dc2626', '#f59e0b', '#059669', '#2563eb'];

      const values = dimensions.map(d => scaledScores[d] || 0);

      const chartConfig = {
        type: 'bar',
        data: {
          labels: fullNames,
          datasets: [{
            data: values,
            backgroundColor: colors,
            borderWidth: 0,
          }],
        },
        options: {
          scales: {
            yAxes: [{
              ticks: { beginAtZero: true, max: 100 },
              scaleLabel: { display: true, labelString: 'Porcentaje (%)', fontStyle: 'bold' },
            }],
            xAxes: [{ ticks: { fontStyle: 'bold' } }],
          },
          legend: { display: false },
          title: { display: true, text: 'Perfil DISC', fontSize: 16, fontStyle: 'bold', fontColor: `#${COLORS.primaryDark}` },
          plugins: { datalabels: { display: true, anchor: 'end', align: 'top', color: '#333', font: { weight: 'bold', size: 14 }, formatter: (v: number) => `${v}%` } },
        },
      };

      const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=500&h=350&bkg=white&f=png`;
      const response = await fetch(url);
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      this.logger.error(`Error generando gráfico DISC: ${error.message}`);
      return null;
    }
  }

  private async generateTACRadarChart(scaledScores: Record<string, number>): Promise<Buffer | null> {
    try {
      const dimensionNames: Record<string, string> = {
        D1: 'Orientación Cliente',
        D2: 'Comunicación',
        D3: 'Empatía',
        D4: 'Resolución Problemas',
        D5: 'Tolerancia Frustración',
        D6: 'Trabajo Presión',
        D7: 'Actitud Positiva',
      };

      const labels = Object.keys(dimensionNames).map(k => dimensionNames[k]);
      const values = Object.keys(dimensionNames).map(k => scaledScores[k] || 0);

      const chartConfig = {
        type: 'radar',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: 'rgba(37, 99, 235, 0.3)',
            borderColor: '#2563eb',
            borderWidth: 2,
            pointBackgroundColor: '#2563eb',
            pointRadius: 4,
          }],
        },
        options: {
          scale: {
            ticks: { beginAtZero: true, max: 5, stepSize: 1 },
            pointLabels: { fontSize: 10, fontStyle: 'bold' },
          },
          legend: { display: false },
          title: { display: true, text: 'Perfil de Competencias TAC', fontSize: 14, fontStyle: 'bold', fontColor: `#${COLORS.primaryDark}` },
        },
      };

      const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=450&h=350&bkg=white&f=png`;
      const response = await fetch(url);
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      this.logger.error(`Error generando gráfico TAC: ${error.message}`);
      return null;
    }
  }

  private createChartParagraph(imageBuffer: Buffer, width = 550, height = 400): Paragraph {
    return new Paragraph({
      children: [
        new ImageRun({
          data: imageBuffer,
          transformation: { width, height },
          type: 'png',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
    });
  }

  // ========== UTILIDADES ==========

  private translateStatus(status: string): string {
    const map: Record<string, string> = {
      pending: 'Pendiente',
      in_process: 'En Proceso',
      in_review: 'En Revisión',
      approved: 'Aprobado',
      rejected: 'Rechazado',
      completed: 'Completado',
    };
    return map[status] || status;
  }
}
