import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/orgs/')({
  component: OrgsListPage,
})

function OrgsListPage() {
  // Stub — paginated org list + create-org form wired up in feat/web-orgs.
  return <div>Orgs</div>
}
