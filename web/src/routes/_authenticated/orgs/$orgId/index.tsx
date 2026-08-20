import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/orgs/$orgId/')({
  component: OrgDetailPage,
})

function OrgDetailPage() {
  const { orgId } = Route.useParams()
  // Stub — boards list + members entry point wired up in feat/web-boards.
  return <div>Org {orgId}</div>
}
