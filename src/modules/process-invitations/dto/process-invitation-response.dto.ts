import { ProcessInvitationStatus } from '../entities/process-invitation.entity';

export class ProcessInvitationResponseDto {
  id: string;
  processId: string;
  processName?: string;
  email: string;
  firstName: string;
  lastName: string;
  status: ProcessInvitationStatus;
  sentAt: Date | null;
  acceptedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  /**
   * Solo en GET by-token: si el correo invitado ya tiene cuenta en Talentree.
   * La página de la invitación lo usa para ofrecer «Iniciar sesión» en vez de
   * «Regístrate» (registrarse de nuevo con ese correo siempre falla).
   */
  tieneCuenta?: boolean;
}
