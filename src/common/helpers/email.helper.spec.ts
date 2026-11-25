import * as nodemailer from 'nodemailer';
import { EmailHelper } from './email.helper';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({}),
    verify: jest.fn().mockResolvedValue(true),
  })),
}));

/**
 * Hallazgos del escaneo SecureBase 2026-11-25 sobre email.helper.ts:
 * - la ruta de la plantilla se unía al cwd sin confinar (path traversal);
 * - las claves de variables se metían crudas en un RegExp;
 * - el transporte SMTP no validaba el certificado TLS (rejectUnauthorized: false),
 *   lo que expone la contraseña SMTP a un MITM;
 * - el destinatario (correo) se escribía en el log de errores.
 */
describe('EmailHelper', () => {
  const entornoOriginal = { ...process.env };

  beforeEach(() => {
    process.env.MAIL_USER = 'usuario-smtp';
    process.env.MAIL_PASSWORD = 'clave-de-prueba';
    delete process.env.MAIL_TLS_REJECT_UNAUTHORIZED;
    (EmailHelper as unknown as { transporter: unknown }).transporter = null;
    (nodemailer.createTransport as jest.Mock).mockClear();
  });

  afterAll(() => {
    process.env = entornoOriginal;
  });

  it('valida el certificado TLS del servidor SMTP por defecto', async () => {
    await EmailHelper.sendEmail('a@ejemplo.cl', 'asunto', 'texto');
    const opciones = (nodemailer.createTransport as jest.Mock).mock.calls[0][0];
    expect(opciones.tls?.rejectUnauthorized).not.toBe(false);
  });

  it('permite desactivar la validación TLS solo de forma explícita', async () => {
    process.env.MAIL_TLS_REJECT_UNAUTHORIZED = 'false';
    await EmailHelper.sendEmail('a@ejemplo.cl', 'asunto', 'texto');
    const opciones = (nodemailer.createTransport as jest.Mock).mock.calls[0][0];
    expect(opciones.tls.rejectUnauthorized).toBe(false);
  });

  it('rechaza plantillas fuera del directorio de la aplicación', async () => {
    const espiaLog = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    await expect(
      EmailHelper.sendTemplateEmail(
        'a@ejemplo.cl',
        'asunto',
        '../../etc/passwd',
        {},
      ),
    ).rejects.toThrow(/plantilla/i);
    await expect(
      EmailHelper.sendTemplateEmail('a@ejemplo.cl', 'asunto', '.env', {}),
    ).rejects.toThrow(/plantilla/i);
    espiaLog.mockRestore();
  });

  it('no escribe el correo del destinatario en el log de errores', async () => {
    const espiaLog = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    await expect(
      EmailHelper.sendTemplateEmail(
        'persona@ejemplo.cl',
        'asunto',
        'no-existe.html',
        {},
      ),
    ).rejects.toThrow();
    const registrado = espiaLog.mock.calls
      .map((c) => c.map(String).join(' '))
      .join('\n');
    expect(registrado).not.toContain('persona@ejemplo.cl');
    espiaLog.mockRestore();
  });

  it('reemplaza variables tratando la clave como texto literal', () => {
    expect(
      EmailHelper.renderTemplate('Hola {{nombre}} {{a.b}} {{axb}}', {
        nombre: 'Ana',
        'a.b': 'punto',
      }),
    ).toBe('Hola Ana punto {{axb}}');
  });
});
