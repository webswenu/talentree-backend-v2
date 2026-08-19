import { ValidationError, BadRequestException } from '@nestjs/common';

/**
 * Mensajes de validacion en espanol (hallazgo P-18).
 *
 * El QA encontro que practicamente toda la API respondia en ingles:
 * 'email must be an email', 'password must be longer than or equal to 6
 * characters'. Solo dos DTO (RegisterWorkerDto y CreateCompanyDto) tenian
 * textos en espanol, lo que ademas lo hacia inconsistente: el mismo formulario
 * podia mostrar un error en espanol y el de al lado en ingles.
 *
 * Ponerle `message` a mano a cada decorador de cada DTO es mucho trabajo y,
 * sobre todo, no evita que el proximo DTO nazca otra vez en ingles. Asi que la
 * traduccion se hace aqui, en el ValidationPipe global: cubre lo que ya existe
 * y lo que se escriba de aqui en adelante.
 *
 * Los `message` explicitos de cada DTO siguen mandando: esto solo traduce los
 * que no tienen uno propio.
 */

/** Traduce el nombre tecnico del campo a algo que el usuario reconozca. */
const NOMBRES_DE_CAMPO: Record<string, string> = {
  email: 'el email',
  password: 'la contraseña',
  firstName: 'el nombre',
  lastName: 'el apellido',
  rut: 'el RUT',
  phone: 'el teléfono',
  name: 'el nombre',
  code: 'el código',
  position: 'el cargo',
  description: 'la descripción',
  companyId: 'la empresa',
  userId: 'el usuario',
  processId: 'el proceso',
  workerId: 'el candidato',
  testId: 'el test',
  startDate: 'la fecha de inicio',
  endDate: 'la fecha de término',
  birthDate: 'la fecha de nacimiento',
  vacancies: 'la cantidad de vacantes',
  status: 'el estado',
  role: 'el rol',
  title: 'el titulo',
  token: 'el enlace',
};

/**
 * Reescribe en espanol los mensajes que genera class-validator.
 * Se trabaja sobre el texto porque class-validator no expone el nombre de la
 * restriccion de forma estable en todas las versiones.
 */
function traducir(propiedad: string, mensaje: string): string {
  const campo = NOMBRES_DE_CAMPO[propiedad] ?? `el campo ${propiedad}`;
  const Campo = campo.charAt(0).toUpperCase() + campo.slice(1);

  const reglas: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
    [/must be an email$/, () => `${Campo} debe ser una dirección de correo válida.`],
    [/should not be empty$/, () => `${Campo} es obligatorio.`],
    [/must be a string$/, () => `${Campo} debe ser texto.`],
    [/must be a number.*$/, () => `${Campo} debe ser un número.`],
    [/must be a boolean value$/, () => `${Campo} debe ser verdadero o falso.`],
    // Formula neutra en genero a proposito: los nombres de campo son unos
    // femeninos y otros masculinos ('la empresa', 'el usuario'), asi que un
    // adjetivo concordado daria 'La empresa seleccionado no es válido'.
    [/must be a UUID$/, () => `${Campo} no tiene un valor válido.`],
    [/must be a valid ISO 8601 date string$/, () => `${Campo} no tiene un formato de fecha válido.`],
    [/must be a Date instance$/, () => `${Campo} no tiene un formato de fecha válido.`],
    [
      /must be longer than or equal to (\d+) characters$/,
      (m) => `${Campo} debe tener al menos ${m[1]} caracteres.`,
    ],
    [
      /must be shorter than or equal to (\d+) characters$/,
      (m) => `${Campo} no puede superar los ${m[1]} caracteres.`,
    ],
    [
      /must not be less than (\d+)$/,
      (m) => `${Campo} no puede ser menor que ${m[1]}.`,
    ],
    [
      /must not be greater than (\d+)$/,
      (m) => `${Campo} no puede ser mayor que ${m[1]}.`,
    ],
    [/must be one of the following values: (.+)$/, (m) => `${Campo} debe ser uno de estos valores: ${m[1]}.`],
    [/must be an array$/, () => `${Campo} debe ser una lista.`],
    [/must be a positive number$/, () => `${Campo} debe ser mayor que cero.`],
  ];

  for (const [patron, construir] of reglas) {
    const m = mensaje.match(patron);
    if (m) return construir(m);
  }

  return mensaje;
}

/** Aplana los errores (incluidos los anidados) a una lista de textos. */
function aplanar(errores: ValidationError[], prefijo = ''): string[] {
  const salida: string[] = [];

  for (const error of errores) {
    const propiedad = prefijo ? `${prefijo}.${error.property}` : error.property;

    for (const mensaje of Object.values(error.constraints ?? {})) {
      // Un mensaje ya escrito en el DTO se respeta tal cual: la heuristica
      // solo actua sobre los textos por defecto de class-validator.
      salida.push(traducir(error.property, mensaje));
    }

    if (error.children?.length) {
      salida.push(...aplanar(error.children, propiedad));
    }
  }

  return salida;
}

/**
 * Fabrica de excepciones del ValidationPipe global.
 * Devuelve los mensajes ya en espanol, en el mismo formato que antes para no
 * romper al frontend, que lee `message` como arreglo.
 */
export function excepcionDeValidacionEnEspanol(errores: ValidationError[]) {
  const mensajes = aplanar(errores);

  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message: mensajes.length
      ? mensajes
      : ['Los datos enviados no son válidos.'],
  });
}
