import { createFileRoute } from '@tanstack/react-router'

import { OrgBoardsPage } from '@/components/boards/OrgBoardsPage'

export const Route = createFileRoute('/_authenticated/orgs/$orgId/')({
  component: OrgDetailPage,
})

function OrgDetailPage() {
  const { orgId } = Route.useParams()
  return <OrgBoardsPage orgId={orgId} />
}
