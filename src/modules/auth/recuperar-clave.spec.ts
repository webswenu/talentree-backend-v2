import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { EmailHelper } from '../../common/helpers/email.helper';
import {
  enmascararEmail,
  normalizarEmail,
} from '../../common/helpers/email-normalizado.helper';

describe('Recuperación de contraseña', () => {
  const jwt = new JwtService({});
  const config = { get: (k: string) => (k === 'JWT_SECRET' ? 'secreto' : undefined) };
  let user: any;
  let userRepository: any;
  let enviados: { to: string; html: string }[];
  let service: AuthService;

  beforeEach(async () => {
    user = {
      id: 'u1',
      email: 'juanperez91@gmail.com',
      firstName: 'Juan',
      lastName: 'Perez',
      isActive: true,
      password: await bcrypt.hash('ClaveVieja1', 4),
    };
    userRepository = {
      findOne: jest.fn(async ({ where }) =>
        where.id === user.id || where.email ? user : null,
      ),
      update: jest.fn(async (_id, cambios) => Object.assign(user, cambios)),
    };
    enviados = [];
    jest
      .spyOn(EmailHelper, 'sendEmail')
      .mockImplementation(async (to, _s, _t, html) => {
        enviados.push({ to, html: html ?? '' });
      });
    service = new AuthService(
      {} as any,
      jwt,
      config as any,
      {} as any,
      {} as any,
      userRepository,
      {} as any,
      { log: jest.fn(async () => undefined) } as any,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  const tokenDelCorreo = () =>
    decodeURIComponent(enviados[0].html.match(/token=([^"&<]+)/)![1]);

  it('envía el enlace y el token sirve una sola vez', async () => {
    await service.solicitarRecuperacion({ email: user.email });
    expect(enviados).toHaveLength(1);
    const token = tokenDelCorreo();

    const r = await service.restablecerClave({ token, password: 'ClaveNueva2' });
    expect(r.email).toBe(user.email);
    expect(await bcrypt.compare('ClaveNueva2', user.password)).toBe(true);

    await expect(
      service.restablecerClave({ token, password: 'OtraClave3' }),
    ).rejects.toThrow(/no es válido o ya expiró/);
  });

  it('responde lo mismo si la cuenta no existe, sin enviar nada', async () => {
    userRepository.findOne.mockResolvedValue(null);
    const r = await service.solicitarRecuperacion({ email: 'nadie@x.com' });
    expect(r.message).toMatch(/Si el correo está registrado/);
    expect(enviados).toHaveLength(0);
  });

  it('rechaza un token de sesión normal', async () => {
    const token = jwt.sign({ sub: 'u1' }, { secret: 'secreto' });
    await expect(
      service.restablecerClave({ token, password: 'ClaveNueva2' }),
    ).rejects.toThrow(/no es válido/);
  });
});

describe('Normalización de correos', () => {
  it('quita espacios y mayúsculas', () => {
    expect(normalizarEmail('  Juanperez@91Gmail.com ')).toBe(
      'juanperez@91gmail.com',
    );
  });

  it('enmascara dejando ver el dominio', () => {
    expect(enmascararEmail('Juanperez@91gmail.com')).toBe(
      'Jua•••@91gmail.com',
    );
    expect(enmascararEmail('ab@x.cl')).toBe('a•••@x.cl');
  });
});
