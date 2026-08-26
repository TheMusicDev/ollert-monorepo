import { createFileRoute } from '@tanstack/react-router'

import { OrgMembersPage } from '@/components/org-members/OrgMembersPage'

export const Route = createFileRoute('/_authenticated/orgs/$orgId/members')({
  component: RouteComponent,
})

function RouteComponent() {
  const { orgId } = Route.useParams()
  return <OrgMembersPage key={orgId} orgId={orgId} />
}
