import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterWorkerDto } from './register-worker.dto';

/**
 * Contrato del registro publico de trabajador.
 *
 * Un caso por hallazgo de la auditoria (R-01 a R-06). Corre sin base de datos
 * y sin servidor: es la red que impide que la pantalla y la API vuelvan a
 * prometer cosas distintas.
 *
 * El formulario inicializa TODOS los campos en cadena vacia y enviaba el
 * objeto entero, asi que los casos con '' no son hipoteticos: son exactamente
 * lo que mandaba el navegador.
 */
const registro = (extra: Record<string, unknown> = {}) =>
  plainToInstance(RegisterWorkerDto, {
    email: 'candidata@ejemplo.cl',
    password: 'GruaQa2026',
    firstName: 'Paulina',
    lastName: 'Riquelme',
    rut: '15678234-3',
    ...extra,
  });

const erroresDe = (dto: RegisterWorkerDto, campo: string) =>
  validateSync(dto)
    .filter((e) => e.property === campo)
    .flatMap((e) => Object.values(e.constraints || {}));

describe('RegisterWorkerDto · campos opcionales en blanco', () => {
  // R-01. El campo se rotula «Teléfono (opcional)» y no se podia dejar vacio.
  it('acepta el telefono vacio, que es lo que manda el formulario', () => {
    expect(erroresDe(registro({ phone: '' }), 'phone')).toEqual([]);
  });

  it('trata el telefono vacio como ausente, no como cadena vacia', () => {
    expect(registro({ phone: '' }).phone).toBeUndefined();
    expect(registro({ phone: '   ' }).phone).toBeUndefined();
  });

  // R-02. El paso 3 se titula «Datos opcionales».
  it('acepta la fecha de nacimiento vacia', () => {
    expect(erroresDe(registro({ birthDate: '' }), 'birthDate')).toEqual([]);
    expect(registro({ birthDate: '' }).birthDate).toBeUndefined();
  });

  it('acepta el resto del paso 3 en blanco', () => {
    const dto = registro({
      address: '',
      city: '',
      region: '',
      education: '',
      experience: '',
    });
    expect(validateSync(dto)).toEqual([]);
  });

  it('sigue rechazando una fecha de nacimiento que no es una fecha', () => {
    expect(
      erroresDe(registro({ birthDate: 'ayer' }), 'birthDate').length,
    ).toBeGreaterThan(0);
  });
});

describe('RegisterWorkerDto · telefono', () => {
  // R-04. El navegador validaba sin espacios y enviaba con espacios.
  it('acepta el telefono como lo escribe la gente', () => {
    for (const escrito of [
      '+56 9 1234 5678',
      '+56912345678',
      '+56-9-1234-5678',
      '(+56) 9 1234 5678',
      '0056 9 1234 5678',
    ]) {
      expect(erroresDe(registro({ phone: escrito }), 'phone')).toEqual([]);
    }
  });

  it('guarda siempre la misma forma, sin importar como se escribio', () => {
    expect(registro({ phone: '+56 9 1234 5678' }).phone).toBe('+56912345678');
    expect(registro({ phone: '0056 9 1234 5678' }).phone).toBe('+56912345678');
  });

  it('acepta prefijos de otros paises', () => {
    for (const internacional of [
      '+54 9 11 2345 6789',
      '+1 415 555 0132',
      '+34 612 345 678',
      '+49 151 23456789',
    ]) {
      expect(erroresDe(registro({ phone: internacional }), 'phone')).toEqual([]);
    }
  });

  it('exige el prefijo del pais y lo dice', () => {
    const fallos = erroresDe(registro({ phone: '912345678' }), 'phone');
    expect(fallos.length).toBeGreaterThan(0);
    expect(fallos.join(' ')).toContain('prefijo');
  });

  it('rechaza mas de 15 digitos, que es el maximo de E.164', () => {
    expect(
      erroresDe(registro({ phone: '+1234567890123456' }), 'phone').length,
    ).toBeGreaterThan(0);
  });

  it('rechaza texto libre', () => {
    expect(
      erroresDe(registro({ phone: 'no tengo' }), 'phone').length,
    ).toBeGreaterThan(0);
  });
});

describe('RegisterWorkerDto · contrasena', () => {
  // R-03. El paso 1 prometia 6 caracteres.
  it('rechaza la contrasena que el paso 1 daba por buena', () => {
    const fallos = erroresDe(registro({ password: 'abc123' }), 'password');
    expect(fallos.join(' ')).toContain('8 caracteres');
  });

  it('exige al menos una mayuscula (D-3)', () => {
    const fallos = erroresDe(registro({ password: 'candidata1' }), 'password');
    expect(fallos.join(' ')).toContain('mayúscula');
  });

  it('exige al menos un numero', () => {
    expect(
      erroresDe(registro({ password: 'Candidataa' }), 'password').length,
    ).toBeGreaterThan(0);
  });

  it('rechaza las contrasenas mas comunes', () => {
    expect(
      erroresDe(registro({ password: '12345678' }), 'password').length,
    ).toBeGreaterThan(0);
  });

  it('acepta una contrasena que cumple', () => {
    expect(erroresDe(registro({ password: 'Talento2026' }), 'password')).toEqual(
      [],
    );
  });
});

describe('RegisterWorkerDto · RUT', () => {
  // R-05. El navegador aceptaba cualquier digito verificador.
  it('rechaza el digito verificador incorrecto', () => {
    const fallos = erroresDe(registro({ rut: '12345678-0' }), 'rut');
    expect(fallos.join(' ')).toContain('dígito verificador');
  });

  // R-06. El texto de ayuda decia «sin puntos».
  it('acepta el RUT escrito con puntos, como se escribe en Chile', () => {
    expect(erroresDe(registro({ rut: '12.345.678-5' }), 'rut')).toEqual([]);
  });

  it('guarda siempre la misma forma', () => {
    expect(registro({ rut: '12.345.678-5' }).rut).toBe('12345678-5');
    expect(registro({ rut: '123456785' }).rut).toBe('12345678-5');
  });
});
