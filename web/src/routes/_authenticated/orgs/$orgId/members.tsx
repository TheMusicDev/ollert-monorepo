import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/orgs/$orgId/members')({
  component: OrgMembersPage,
})

function OrgMembersPage() {
  const { orgId } = Route.useParams()
  // Stub — paginated members table + add-by-email form wired up in feat/web-org-members.
  return <div>Org {orgId} members</div>
}
