import { describe, expect, it } from 'vitest'

import type { OrgMember, OrgSummary } from './org-members'
import { canRemoveMember, findCurrentMember, isOrgOwner } from './org-members'

const owner: OrgMember = {
  id: 'm1',
  userId: 'u-owner',
  email: 'owner@example.com',
  displayName: 'Owner',
  created: '2026-01-01',
}

const member: OrgMember = {
  id: 'm2',
  userId: 'u-member',
  email: 'member@example.com',
  displayName: null,
  created: '2026-01-02',
}

const org: OrgSummary = { id: 'org-1', ownerId: 'u-owner', name: 'Acme' }

describe('findCurrentMember', () => {
  it('matches a member by case-insensitive email', () => {
    expect(findCurrentMember([owner, member], 'MEMBER@example.com')).toBe(
      member,
    )
  })

  it('returns undefined when the email is not among the members', () => {
    expect(findCurrentMember([owner, member], 'nobody@example.com')).toBe(
      undefined,
    )
  })

  it('returns undefined when no email is given', () => {
    expect(findCurrentMember([owner, member], undefined)).toBe(undefined)
    expect(findCurrentMember([owner, member], null)).toBe(undefined)
  })
})

describe('isOrgOwner', () => {
  it('is true when the current member is the org owner', () => {
    expect(isOrgOwner(org, owner)).toBe(true)
  })

  it('is false when the current member is not the org owner', () => {
    expect(isOrgOwner(org, member)).toBe(false)
  })

  it('is false when the org or current member is missing', () => {
    expect(isOrgOwner(null, owner)).toBe(false)
    expect(isOrgOwner(org, undefined)).toBe(false)
  })
})

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
