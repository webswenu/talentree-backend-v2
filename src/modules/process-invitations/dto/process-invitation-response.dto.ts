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
}
