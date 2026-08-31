import { createFileRoute } from '@tanstack/react-router'

import { AdminUsersPage } from '@/components/admin/AdminUsersPage'

export const Route = createFileRoute('/_authenticated/admin/')({
  component: AdminUsersPage,
})
