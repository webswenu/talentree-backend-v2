export enum ReportStatus {
  PENDING_APPROVAL = 'pending_approval', // Generado automáticamente, esperando descarga y edición
  REVISION_EVALUADOR = 'revision_evaluador', // Evaluador subió PDF, esperando revisión de Admin
  REVISION_ADMIN = 'revision_admin', // Admin debe revisar antes de aprobar
  APPROVED = 'approved', // Aprobado por Admin, visible para Empresa
  REJECTED = 'rejected', // Rechazado por Admin
}
