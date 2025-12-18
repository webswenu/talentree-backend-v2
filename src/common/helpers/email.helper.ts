import * as nodemailer from 'nodemailer';
import { readFileSync } from 'fs';
import { join } from 'path';

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
      tls: {
        rejectUnauthorized: false,
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

  static async sendTemplateEmail(
    to: string,
    subject: string,
    templatePath: string,
    variables: Record<string, string>,
  ): Promise<void> {
    try {
      const templateFilePath = join(process.cwd(), templatePath);
      let htmlContent = readFileSync(templateFilePath, 'utf8');

      Object.keys(variables).forEach((key) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        htmlContent = htmlContent.replace(regex, variables[key]);
      });

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
      console.error(`Error sending template email to ${to}:`, error);
      throw error;
    }
  }
}
