import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Coherencia entre dos fechas (hallazgo P-25).
 *
 * Se podia crear un proceso con fecha de término ANTERIOR a la de inicio
 * (startDate 2026-09-01 con endDate 2026-08-01 devolvia HTTP 201). No habia
 * validacion cruzada ni en el DTO ni en el servicio: class-validator valida
 * campo por campo, asi que una regla que relaciona dos campos hay que
 * escribirla a mano.
 */
@ValidatorConstraint({ name: 'esPosteriorA', async: false })
class EsPosteriorAConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const [campoInicio] = args.constraints as [string];
    const inicio = (args.object as Record<string, unknown>)[campoInicio];

    // Si falta cualquiera de las dos, no hay nada que comparar: de eso se
    // encargan @IsOptional() y @IsDateString() por separado.
    if (!value || !inicio) return true;

    const desde = new Date(inicio as string).getTime();
    const hasta = new Date(value as string).getTime();

    if (Number.isNaN(desde) || Number.isNaN(hasta)) return true;

    return hasta >= desde;
  }

  defaultMessage(): string {
    return 'La fecha de término no puede ser anterior a la fecha de inicio.';
  }
}

export function EsPosteriorA(
  campoInicio: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [campoInicio],
      validator: EsPosteriorAConstraint,
    });
  };
}
