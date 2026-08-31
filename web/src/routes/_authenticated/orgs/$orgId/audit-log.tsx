import { useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { AuditLogTable } from '@/components/admin/AuditLogTable'
import { listOrgAuditLog } from '@/lib/audit-log-api'

export const Route = createFileRoute('/_authenticated/orgs/$orgId/audit-log')({
  component: OrgAuditLogRoute,
})

function OrgAuditLogRoute() {
  const { orgId } = Route.useParams()
  return <OrgAuditLogPage key={orgId} orgId={orgId} />
}

/** `/orgs/:orgId/audit-log` — that org's owner only, gated server-side. */
function OrgAuditLogPage({ orgId }: { orgId: string }) {
  const fetchPage = useCallback(
    (page: number, limit: number) => listOrgAuditLog(orgId, page, limit),
    [orgId],
  )

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        Audit log
      </h1>
      <AuditLogTable fetchPage={fetchPage} />
    </div>
  )
}
