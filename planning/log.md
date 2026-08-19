# Planning Log

## 2026-08-19
* **Initialization**: Created the planning OKF bundle for Ollert (stripped-down Trello clone: CakePHP backend, Supabase Auth, Vite+React frontend).
* **Decisions**: MVP scope set to bare-bones (boards/lists/cards/drag-drop/board members, no roles). App data placed in CakePHP-owned MySQL, not Supabase Postgres — Supabase used auth-only. JWT verification set to JWKS/RS256 with HS256 documented as fallback. Repo layout set to monorepo (`/api`, `/web`, `/planning`).
* **Realtime reconsidered**: Initially requested for day 1, but Supabase Realtime requires the data to live in Supabase's own Postgres (it watches Postgres logical replication), which conflicts with the MySQL/CakePHP-owned-DB decision. Options were a self-hosted Pusher-protocol relay (Soketi) or SSE from CakePHP; user chose to drop realtime from MVP entirely rather than take on either now. Revisit in a later phase — see [Roadmap](roadmap.md).
* **Update**: Added `organizations` above boards — an org has many boards. Dropped `board_members`; added `org_members` instead. Access is org-scoped: any org member has access to every board under that org (no per-board membership/roles in v1). Updated [Data Model](data-model.md), [API Contract](api-contract.md), and [Roadmap](roadmap.md) accordingly.
