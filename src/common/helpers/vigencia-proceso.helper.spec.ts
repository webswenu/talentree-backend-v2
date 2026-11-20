import { fechaComoDia, hoyEnChile, procesoVencido } from './vigencia-proceso.helper';

describe('vigencia del proceso', () => {
  // Noviembre: Chile está en horario de verano (UTC-3).
  it('hoy en Chile no es el día UTC', () => {
    expect(hoyEnChile(new Date('2026-11-21T02:30:00Z'))).toBe('2026-11-20');
    expect(hoyEnChile(new Date('2026-11-21T03:30:00Z'))).toBe('2026-11-21');
  });

  it('el último día sigue abierto hasta la medianoche de Chile', () => {
    // El cierre automático corre a las 03:00 UTC = 00:00 en Chile.
    expect(procesoVencido('2026-11-20', new Date('2026-11-20T03:00:00Z'))).toBe(false);
    expect(procesoVencido('2026-11-20', new Date('2026-11-21T02:59:00Z'))).toBe(false);
    expect(procesoVencido('2026-11-20', new Date('2026-11-21T03:00:00Z'))).toBe(true);
  });

  it('sin fecha de término no vence', () => {
    expect(procesoVencido(null)).toBe(false);
    expect(procesoVencido(undefined)).toBe(false);
  });

  it('lee la fecha como texto o como Date', () => {
    expect(fechaComoDia('2026-11-25')).toBe('2026-11-25');
    expect(fechaComoDia('2026-11-25T00:00:00.000Z')).toBe('2026-11-25');
    expect(fechaComoDia(new Date('2026-11-25T00:00:00Z'))).toBe('2026-11-25');
    expect(fechaComoDia('no es fecha')).toBeNull();
    expect(fechaComoDia('')).toBeNull();
  });
});
