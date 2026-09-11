import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateWorkerDto } from './create-worker.dto';

/**
 * Fija que dar de alta un candidato SIEMPRE exija una contraseña.
 *
 * Antes el campo era opcional y, cuando no venía, el servicio asignaba una
 * contraseña fija escrita en el código de un repositorio público. Quien
 * conociera el correo del candidato entraba a su cuenta.
 */
const alta = (extra: Record<string, unknown> = {}) =>
  plainToInstance(CreateWorkerDto, {
    firstName: 'Rodrigo',
    lastName: 'Fuentes',
    rut: '15678234-3',
    email: 'rodrigo@ejemplo.cl',
    ...extra,
  });

const erroresDe = (dto: CreateWorkerDto, campo: string) =>
  validateSync(dto)
    .filter((e) => e.property === campo)
    .flatMap((e) => Object.values(e.constraints || {}));

describe('CreateWorkerDto · contraseña', () => {
  it('rechaza el alta sin contraseña', () => {
    const fallos = erroresDe(alta(), 'password');

    expect(fallos.length).toBeGreaterThan(0);
    expect(fallos.join(' ')).toContain('La contraseña es obligatoria');
  });

  it('rechaza la contraseña vacía', () => {
    expect(erroresDe(alta({ password: '' }), 'password').length).toBeGreaterThan(0);
  });

  it('rechaza una contraseña débil', () => {
    expect(erroresDe(alta({ password: '123' }), 'password').length).toBeGreaterThan(0);
    expect(erroresDe(alta({ password: 'abcdefgh' }), 'password').length).toBeGreaterThan(0);
  });

  it('acepta una contraseña que cumple los requisitos', () => {
    expect(erroresDe(alta({ password: 'GruaQa2026' }), 'password')).toEqual([]);
  });

  it('el mensaje dice qué hacer, no solo que falta', () => {
    const fallos = erroresDe(alta(), 'password').join(' ');

    expect(fallos).toContain('comunícasela a la persona');
  });
});

/**
 * R-10. El formato de telefono existia SOLO en el registro publico. El mismo
 * candidato al que se le exigio '+56912345678' para entrar podia dejarlo en
 * 'no tengo' al dia siguiente, porque ni el alta desde el panel ni la edicion
 * de perfil validaban nada. La regla tiene que valer en todas las vias que
 * escriben el dato, o dura hasta el primer cambio.
 */
describe('CreateWorkerDto · telefono', () => {
  it('acepta el telefono como lo escribe la gente', () => {
    for (const escrito of ['+56 9 1234 5678', '+56912345678', '+1 415 555 0132']) {
      expect(erroresDe(alta({ password: 'GruaQa2026', phone: escrito }), 'phone')).toEqual([]);
    }
  });

  it('guarda siempre la misma forma', () => {
    const dto = alta({ password: 'GruaQa2026', phone: '+56 9 1234 5678' });
    expect(dto.phone).toBe('+56912345678');
  });

  it('exige el prefijo del pais', () => {
    const fallos = erroresDe(alta({ password: 'GruaQa2026', phone: '912345678' }), 'phone');
    expect(fallos.join(' ')).toContain('prefijo');
  });

  it('rechaza el texto libre que antes se guardaba tal cual', () => {
    expect(
      erroresDe(alta({ password: 'GruaQa2026', phone: 'no tengo' }), 'phone').length,
    ).toBeGreaterThan(0);
  });

  it('trata el telefono vacio como ausente', () => {
    expect(erroresDe(alta({ password: 'GruaQa2026', phone: '' }), 'phone')).toEqual([]);
    expect(alta({ password: 'GruaQa2026', phone: '' }).phone).toBeUndefined();
  });
});

describe('CreateWorkerDto · contrasena con mayuscula (D-3)', () => {
  it('rechaza la contrasena sin mayuscula', () => {
    const fallos = erroresDe(alta({ password: 'gruaqa2026' }), 'password');
    expect(fallos.join(' ')).toContain('mayúscula');
  });
});
