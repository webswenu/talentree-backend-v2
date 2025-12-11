import { Injectable, Logger } from '@nestjs/common';
import { SendContactFormDto } from './contact.dto';
import { EmailHelper } from '../../common/helpers/email.helper';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);
  private readonly contactEmail = 'contacto@talentree.cl';

  /**
   * Procesa el formulario de contacto y envía dos correos:
   * 1. Confirmación al remitente
   * 2. Notificación al equipo de Talentree
   */
  async sendContactForm(dto: SendContactFormDto): Promise<{ message: string }> {
    this.logger.log(
      `Procesando formulario de contacto de ${dto.nombre} (${dto.correo})`,
    );

    try {
      // Enviar correo de confirmación al remitente
      await this.sendConfirmationEmail(dto);

      // Enviar notificación al equipo de Talentree
      await this.sendNotificationEmail(dto);

      this.logger.log(
        `Formulario de contacto procesado exitosamente para ${dto.correo}`,
      );

      return {
        message:
          'Tu mensaje ha sido enviado exitosamente. Nos pondremos en contacto contigo pronto.',
      };
    } catch (error) {
      this.logger.error(
        `Error al procesar formulario de contacto: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Envía correo de confirmación al remitente
   */
  private async sendConfirmationEmail(dto: SendContactFormDto): Promise<void> {
    const subject = 'Gracias por contactarnos - Talentree';

    const textContent = `Hola ${dto.nombre},

Gracias por contactarnos. Hemos recibido tu mensaje y nuestro equipo se pondrá en contacto contigo lo antes posible.

Resumen de tu consulta:
- Nombre: ${dto.nombre}
- Teléfono: ${dto.telefono}
- Email: ${dto.correo}
- Asunto: ${dto.asunto}

Saludos,
Equipo Talentree`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .summary { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #14b8a6; }
    .summary-item { margin: 10px 0; }
    .summary-label { font-weight: bold; color: #0d9488; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>¡Gracias por contactarnos!</h1>
    </div>
    <div class="content">
      <p>Hola <strong>${dto.nombre}</strong>,</p>
      <p>Gracias por contactarnos. Hemos recibido tu mensaje y nuestro equipo se pondrá en contacto contigo lo antes posible.</p>

      <div class="summary">
        <h3 style="margin-top: 0; color: #0d9488;">Resumen de tu consulta:</h3>
        <div class="summary-item">
          <span class="summary-label">Nombre:</span> ${dto.nombre}
        </div>
        <div class="summary-item">
          <span class="summary-label">Teléfono:</span> ${dto.telefono}
        </div>
        <div class="summary-item">
          <span class="summary-label">Email:</span> ${dto.correo}
        </div>
        <div class="summary-item">
          <span class="summary-label">Asunto:</span> ${dto.asunto}
        </div>
      </div>

      <p>Saludos,<br><strong>Equipo Talentree</strong></p>
    </div>
    <div class="footer">
      <p>Este es un correo automático. Por favor no respondas a este mensaje.</p>
    </div>
  </div>
</body>
</html>`;

    await EmailHelper.sendEmail(dto.correo, subject, textContent, htmlContent);
  }

  /**
   * Envía correo de notificación al equipo de Talentree
   */
  private async sendNotificationEmail(dto: SendContactFormDto): Promise<void> {
    const subject = `Nuevo mensaje de contacto de ${dto.nombre}`;

    const textContent = `Nuevo mensaje recibido desde el formulario de contacto:

Datos del remitente:
- Nombre: ${dto.nombre}
- Teléfono: ${dto.telefono}
- Email: ${dto.correo}

Mensaje:
${dto.asunto}

---
Sistema de contacto Talentree`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed; }
    .info-item { margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .info-item:last-child { border-bottom: none; }
    .info-label { font-weight: bold; color: #6366f1; display: inline-block; min-width: 100px; }
    .message-box { background: #ede9fe; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📧 Nuevo Mensaje de Contacto</h1>
    </div>
    <div class="content">
      <p>Se ha recibido un nuevo mensaje desde el formulario de contacto de la landing page.</p>

      <div class="info-box">
        <h3 style="margin-top: 0; color: #6366f1;">Datos del Remitente:</h3>
        <div class="info-item">
          <span class="info-label">Nombre:</span> ${dto.nombre}
        </div>
        <div class="info-item">
          <span class="info-label">Teléfono:</span> ${dto.telefono}
        </div>
        <div class="info-item">
          <span class="info-label">Email:</span> <a href="mailto:${dto.correo}">${dto.correo}</a>
        </div>
      </div>

      <div class="message-box">
        <h3 style="margin-top: 0; color: #6366f1;">Mensaje:</h3>
        <p style="margin: 0; white-space: pre-wrap;">${dto.asunto}</p>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
        <strong>Nota:</strong> Por favor responde directamente al email del remitente: ${dto.correo}
      </p>
    </div>
    <div class="footer">
      <p>Sistema de contacto Talentree - Notificación automática</p>
    </div>
  </div>
</body>
</html>`;

    await EmailHelper.sendEmail(
      this.contactEmail,
      subject,
      textContent,
      htmlContent,
    );
  }
}
