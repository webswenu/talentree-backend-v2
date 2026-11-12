import { Transform } from 'class-transformer';

/**
 * Trata la cadena vacia como campo ausente (hallazgos R-01 y R-02).
 *
 * @IsOptional() de class-validator solo salta undefined y null. Una cadena
 * vacia SI entra al validador y falla, asi que un campo rotulado «opcional»
 * en pantalla se comportaba como obligatorio en la API: el formulario
 * inicializa todo en '' y envia el objeto entero, y quien no escribia nada en
 * «Teléfono (opcional)» o en la fecha de nacimiento no podia registrarse.
 *
 * Se corrige en el DTO y no solo en el formulario a proposito: la API se puede
 * llamar directamente, y la regla tiene que valer para cualquier cliente.
 */
export const VacioComoAusente = () =>
  Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  );
