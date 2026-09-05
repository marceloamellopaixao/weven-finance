import { writeAdminAuditLog } from "@/lib/audit/admin";

export function writeWorkspaceAuditLog(input: {
  actorUid: string;
  action: string;
  workspaceUid: string;
  workspaceId: string;
  targetUid?: string | null;
  requestId?: string | null;
  route?: string | null;
  method?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
}) {
  return writeAdminAuditLog({
    actorUid: input.actorUid,
    action: `workspace.${input.action}`,
    targetUid: input.targetUid,
    requestId: input.requestId,
    route: input.route,
    method: input.method,
    ip: input.ip,
    userAgent: input.userAgent,
    details: {
      scope: "workspace",
      workspaceUid: input.workspaceUid,
      workspaceId: input.workspaceId,
      ...(input.details || {}),
    },
  });
}
