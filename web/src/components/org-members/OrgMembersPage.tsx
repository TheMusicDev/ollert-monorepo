import { useEffect, useState } from 'react'

import { ApiError } from '@/lib/api-client'
import type { PaginationMeta } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'
import {
  addOrgMemberByEmail,
  fetchOrg,
  fetchOrgMembers,
  removeOrgMember,
} from '@/lib/org-members'
import type { OrgMember, OrgSummary } from '@/lib/org-members'

import { AddMemberForm } from './AddMemberForm'
import { MembersTable } from './MembersTable'

interface OrgMembersPageProps {
  orgId: string
}

/**
 * `/orgs/:orgId/members` page content: paginated member list + add-by-email
 * form. See fe-tasks.md's `feat/web-org-members` entry.
 */
export function OrgMembersPage({ orgId }: OrgMembersPageProps) {
  const { user } = useAuth()

  const [org, setOrg] = useState<OrgSummary | null>(null)
  const [orgError, setOrgError] = useState<string | null>(null)

  const [members, setMembers] = useState<OrgMember[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [page, setPage] = useState(1)
  const [membersLoading, setMembersLoading] = useState(true)
  const [membersError, setMembersError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setOrgError(null)
    fetchOrg(orgId)
      .then((result) => {
        if (!cancelled) setOrg(result)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setOrgError(
          err instanceof ApiError
            ? err.message
            : 'Failed to load organization.',
        )
      })
    return () => {
      cancelled = true
    }
  }, [orgId])

  useEffect(() => {
    let cancelled = false
    setMembersLoading(true)
    setMembersError(null)
    fetchOrgMembers(orgId, page)
      .then((result) => {
        if (cancelled) return
        setMembers(result.data)
        setMeta(result.meta)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setMembersError(
          err instanceof ApiError ? err.message : 'Failed to load members.',
        )
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [orgId, page, reloadToken])

  const isOwner = org?.is_owner ?? false

  const handleAdd = async (email: string) => {
    await addOrgMemberByEmail(orgId, email)
    if (page === 1) {
      setReloadToken((token) => token + 1)
    } else {
      setPage(1)
    }
  }

  const handleRemove = async (member: OrgMember) => {
    await removeOrgMember(orgId, member.user_id)
    if (members.length === 1 && page > 1) {
      setPage((current) => current - 1)
    } else {
      setReloadToken((token) => token + 1)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Members{org ? ` of ${org.name}` : ''}
        </h1>
        {orgError && (
          <p
            role="alert"
            className="mt-1 text-sm text-red-600 dark:text-red-400"
          >
            {orgError}
          </p>
        )}
      </div>

      <div className="shadow-bottom rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Add a member
        </h2>
        <AddMemberForm onAdd={handleAdd} />
      </div>

      <MembersTable
        members={members}
        meta={meta}
        loading={membersLoading}
        error={membersError}
        currentUserEmail={user?.email}
        isOwner={isOwner}
        page={page}
        onPageChange={setPage}
        onRemove={handleRemove}
      />
    </div>
  )
}
