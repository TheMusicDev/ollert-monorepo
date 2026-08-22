import { describe, expect, it } from 'vitest'

import type { OrgMember } from './org-members'
import { canRemoveMember } from './org-members'

const owner: OrgMember = {
  id: 'm1',
  org_id: 'org-1',
  user_id: 'u-owner',
  user: { id: 'u-owner', email: 'owner@example.com', display_name: 'Owner' },
  created: '2026-01-01',
}

const member: OrgMember = {
  id: 'm2',
  org_id: 'org-1',
  user_id: 'u-member',
  user: { id: 'u-member', email: 'member@example.com', display_name: null },
  created: '2026-01-02',
}

describe('canRemoveMember', () => {
  it('lets an owner remove anyone', () => {
    expect(canRemoveMember(member, 'owner@example.com', true)).toBe(true)
  })

  it('lets a member remove themself', () => {
    expect(canRemoveMember(member, 'member@example.com', false)).toBe(true)
  })

  it('blocks a non-owner from removing someone else', () => {
    expect(canRemoveMember(owner, 'member@example.com', false)).toBe(false)
  })

  it('blocks removal when there is no known current user', () => {
    expect(canRemoveMember(member, null, false)).toBe(false)
  })
})
