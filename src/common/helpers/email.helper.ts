import * as nodemailer from 'nodemailer';
import { readFileSync } from 'fs';
import { resolve, sep } from 'path';

export class EmailHelper {
  private static transporter: nodemailer.Transporter | null = null;

  private static getTransporter(): nodemailer.Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    if (!process.env.MAIL_USER || !process.env.MAIL_PASSWORD) {
      throw new Error(
        'Email credentials not configured - Check console for details',
      );
    }

    // Usar Amazon SES si está configurado, sino Gmail como fallback
    const host = process.env.MAIL_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.MAIL_PORT || '587', 10);

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true para 465, false para otros puertos
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
      },
      // El certificado del servidor SMTP se valida siempre (SES y Gmail tienen
      // certificados válidos). Solo se puede desactivar de forma explícita, p. ej.
      // para un servidor de pruebas local con certificado autofirmado.
      tls: {
        rejectUnauthorized: process.env.MAIL_TLS_REJECT_UNAUTHORIZED !== 'false',
      },
    });

    return this.transporter;
  }

  static async verifyConnection(): Promise<boolean> {
    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      return true;
    } catch (error) {
      return false;
    }
  }

  static async sendEmail(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<void> {
    try {
      await this.getTransporter().sendMail({
        from: `"Talentree" <${
          process.env.EMAIL_FROM_ADDRESS || 'no-reply@talentree.com'
        }>`,
        to,
        subject,
        text,
        html: html || text,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * La plantilla tiene que ser un .html dentro del directorio de la aplicación.
   */
  private static resolveTemplatePath(templatePath: string): string {
    const raiz = resolve(process.cwd());
    const destino = resolve(raiz, String(templatePath ?? ''));
    if (!destino.startsWith(raiz + sep) || !destino.toLowerCase().endsWith('.html')) {
      throw new Error('Ruta de plantilla de correo no permitida');
    }
    return destino;
  }

  /**
   * Reemplaza {{clave}} por su valor. La clave se trata como texto literal, no
   * como expresión regular.
   */
  static renderTemplate(html: string, variables: Record<string, string>): string {
    let resultado = html;
    Object.keys(variables).forEach((key) => {
      resultado = resultado.split(`{{${key}}}`).join(variables[key]);
    });
    return resultado;
  }

  static async sendTemplateEmail(
    to: string,
    subject: string,
    templatePath: string,
    variables: Record<string, string>,
  ): Promise<void> {
    try {
      const templateFilePath = this.resolveTemplatePath(templatePath);
      let htmlContent = this.renderTemplate(
        readFileSync(templateFilePath, 'utf8'),
        variables,
      );

      const remainingVars = htmlContent.match(/{{[^{}]+}}/g);
      if (remainingVars) {
        htmlContent = htmlContent.replace(
          /{{support_email}}/g,
          'soporte@talentree.com',
        );
        htmlContent = htmlContent.replace(
          /{{logo_url}}/g,
          'https://talentree.com/logo.png',
        );
      }

      const textContent = `${subject}\n\n${
        variables.plainTextContent ||
        'Por favor, utiliza un cliente de correo que soporte HTML para ver este mensaje correctamente.'
      }`;

      await this.sendEmail(to, subject, textContent, htmlContent);
    } catch (error) {
      // Sin el destinatario: el correo es un dato personal (Ley 21.719).
      console.error('Error sending template email:', error);
      throw error;
    }
  }
}
