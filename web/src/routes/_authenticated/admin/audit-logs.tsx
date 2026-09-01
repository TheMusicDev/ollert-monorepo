import { createFileRoute } from '@tanstack/react-router'

import { AuditLogTable } from '@/components/admin/AuditLogTable'
import { listAuditLogs } from '@/lib/audit-log-api'

export const Route = createFileRoute('/_authenticated/admin/audit-logs')({
  component: AdminAuditLogsPage,
})

/** `/admin/audit-logs` — platform-wide audit trail, admin-gated server-side. */
function AdminAuditLogsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        Audit log
      </h1>
      <AuditLogTable fetchPage={listAuditLogs} />
    </div>
  )
}
