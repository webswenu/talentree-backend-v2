import { Logger } from '@nestjs/common';
import { WorkersService } from './workers.service';
import { EmailHelper } from '../../common/helpers/email.helper';

/**
 * Correos de aprobación y rechazo: el nombre del postulante, del proceso y de
 * la empresa los escriben usuarios (el propio postulante o la empresa), así
 * que van escapados en el HTML. Y el correo del destinatario no va al log.
 */
describe('WorkersService · correos de cambio de estado', () => {
  const servicio = new (
    WorkersService as unknown as new (...a: unknown[]) => WorkersService
  )();
  const llamar = (
    metodo: 'sendApprovalEmail' | 'sendRejectionEmail',
    ...args: string[]
  ) =>
    (servicio as unknown as Record<string, (...a: string[]) => Promise<void>>)[
      metodo
    ](...args);

  let espiaCorreo: jest.SpyInstance;
  let espiaLog: jest.SpyInstance;
  let espiaError: jest.SpyInstance;

  beforeEach(() => {
    espiaCorreo = jest
      .spyOn(EmailHelper, 'sendEmail')
      .mockResolvedValue(undefined);
    espiaLog = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    espiaError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each(['sendApprovalEmail', 'sendRejectionEmail'] as const)(
    '%s escapa los datos en el HTML',
    async (metodo) => {
      await llamar(
        metodo,
        'persona@ejemplo.cl',
        '<img src=x onerror=alert(1)>',
        'Proceso <b>X</b>',
        'Empresa "&" Cía',
      );
      const html: string = espiaCorreo.mock.calls[0][3];
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(html).toContain('Proceso &lt;b&gt;X&lt;/b&gt;');
      expect(html).toContain('Empresa &quot;&amp;&quot; Cía');
    },
  );

  it.each(['sendApprovalEmail', 'sendRejectionEmail'] as const)(
    '%s no registra el correo del destinatario',
    async (metodo) => {
      await llamar(metodo, 'persona@ejemplo.cl', 'Ana', 'Proceso', 'Empresa');
      espiaCorreo.mockRejectedValueOnce(new Error('smtp caído'));
      await llamar(metodo, 'persona@ejemplo.cl', 'Ana', 'Proceso', 'Empresa');
      const registrado = [...espiaLog.mock.calls, ...espiaError.mock.calls]
        .map((c) => c.map(String).join(' '))
        .join('\n');
      expect(registrado).not.toContain('persona@ejemplo.cl');
    },
  );
});
