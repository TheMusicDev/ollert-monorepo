import { createFileRoute } from '@tanstack/react-router'

import { OrgsPage } from '@/components/orgs/OrgsPage'

export const Route = createFileRoute('/_authenticated/orgs/')({
  component: OrgsPage,
})
