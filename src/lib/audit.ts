import type { DbClient } from './db';

export async function recordAuditEvent(
  db: DbClient,
  params: {
    entityType: string;
    entityId: number;
    action: string;
    fieldChanges?: Record<string, unknown>;
  }
) {
  return db.auditEvent.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      fieldChanges: JSON.stringify(params.fieldChanges ?? {}, Object.keys(params.fieldChanges ?? {}).sort()),
    },
  });
}
