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
