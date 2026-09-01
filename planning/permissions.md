---
type: Architecture
title: Permission System
description: How org/board/list/card authorization actually works today (verified against code), plus deferred ideas for a future revisit.
tags: [permissions, authorization, roles, org-members]
status: stable
generated: { by: "claude-code/sonnet-5", at: "2026-08-30T00:00:00Z" }
---

# Summary

Two roles only, both binary and org-wide: **owner** (`organizations.owner_id`) and **member** (an `org_members` row, or the owner implicitly — `App\Service\OrgAuthorizationService::isOrgMember()`). No per-board roles, no "admin"/"editor" tier, no invite/accept flow for org membership. **Reviewed and accepted as-is 2026-08-30** — see [Change log](log.md) — with a short list of deferred ideas below for if/when it stops being enough.

# Current model

Full matrix, verified by reading every controller action directly (not assumed from naming):

| Action | Who | Source |
|---|---|---|
| Create org | any authenticated user (becomes owner) | `OrganizationsController::add` |
| View/list orgs | member | `assertMember` |
| Rename org | any member | `OrganizationsController::edit` — no owner check |
| Delete org | **owner only** | `OrganizationsController::delete` |
| List org members | member | `assertMember` |
| Add org member (by email) | any member | `OrgMembersController::add` — no owner check |
| Remove org member | owner, or the member removing themself | `OrgMembersController::delete` |
| **Create board** | **owner only** (403 for non-owner members) | `BoardsController::add`, `assertOrgOwner` |
| View/rename/delete board | any member | `BoardsController::view/edit/delete` |
| Create/rename/reposition/delete list | any member | `ListsController` |
| Create/rename/move/delete card | any member | `CardsController` |

Two things worth naming explicitly, since they cut against the intuitive "owners have most write permissions" framing:

- **Board/list/card CRUD — the bulk of actual app usage — is already fully open to any member.** Once a board exists, any member can create/rename/move/delete lists and cards on it, no ownership required. Only board *creation itself* is owner-gated.
- **Adding a new member is open to any existing member, not just the owner**, and there's no invite/accept step — it's a direct, silent add by email (`OrgMembersController::add`). The person being added never consents.

The one clearly-gated creation path (boards) is deliberate, not an oversight: **quotas are attributed to the org owner's `users` row regardless of who performs the action** — `max_boards_per_org` is checked when *the owner* creates a board; `max_lists_per_board`/`max_cards_per_board` are checked against the *owner's* column even when *any other member* creates the list/card (`App\Service\QuotaService` docblock; see [Data Model § Quotas](data-model.md#quotas)). [Roadmap § Key Decisions Log](roadmap.md#key-decisions-log) states the board rule outright: "Board creation is org-owner-only (it's what spends the quota); other board actions remain open to any org member." List/card creation stayed open to any member despite *also* drawing down the owner's quota — board creation is the one place the permission gate and the quota-spender are required to be the same person.

Related but separate axis: a **global** `is_admin` flag on `users` (feature #20, not yet built — see [Roadmap](roadmap.md), [API Contract § Admin](api-contract.md#admin)) is for platform-level quota overrides, not org-level roles. Keep the two apart in any future redesign.

# Deferred ideas (not decided, no timeline)

Recorded so they're not lost, not because anything below is currently needed:

- **A. Loosen board creation to any member.** Simplest change, matches how lists/cards already work. Tension: a member could spend the owner's `max_boards_per_org` quota without the owner acting themselves — the same tradeoff list/card creation already accepts.
- **B. A real middle role** (`org_members.role`: `member`/`admin`, owner stays `organizations.owner_id`). Owner delegates board-creation/member-management to a trusted member without transferring ownership. More schema/API-contract surface than A; only worth it if a two-tier model stops being enough.
- **C. Rethink quota attribution.** The actual tension is less "who's allowed" than "whose quota pays for it." Options: a per-org quota pool independent of any one user, or keep owner-attributed but give the owner visibility/caps per member. Bigger change — quotas currently live on `users`, not `organizations` (see [Data Model § Quotas](data-model.md#quotas)).
- **D. Add consent to member-add** (invite + accept instead of direct add), independently of whether add-a-member stays open to any member or gets tightened to owner-only — these are two separate axes bundled together today.
- **E. Per-board membership/roles** — already named as explicitly out of scope for v1 in [Roadmap](roadmap.md) ("no per-board membership or roles in v1"). Bigger scope than the others; only worth raising if org-wide membership itself turns out to be too coarse.

Not covered here because there's no evidence they need changing: board/list/card edit/delete (already open to any member), member self-removal.
