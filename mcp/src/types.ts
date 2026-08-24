// Resource shapes mirrored from planning/api-contract.md. The contract doc is
// the sole authority; this file only types what the tool layer reads/writes.

export interface Org {
  id: string;
  name: string;
  owner_id: string;
  is_owner: boolean;
  created?: string;
  // GET /api/orgs/:id includes its boards.
  boards?: Board[];
}

export interface OrgMember {
  id: string;
  email: string;
  // owner_id is the org's owner; members list doesn't carry is_owner per-row
  // in the contract, but the owner row is identifiable by id === org.owner_id.
}

export interface Board {
  id: string;
  org_id: string;
  name: string;
  // GET /api/boards/:id includes lists + cards nested, unpaginated.
  lists?: List[];
}

export interface List {
  id: string;
  board_id: string;
  name: string;
  position: number | string;
  cards?: Card[];
}

export interface Card {
  id: string;
  list_id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  position: number | string;
}

// Paginated collection envelope (api-contract.md#pagination).
export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

// Error envelope (api-contract.md#error-response-shape). `fields` is Partial —
// only keys that actually failed validation are present.
export interface ApiErrorBody {
  error: {
    message: string;
    code: string;
    fields?: Partial<Record<string, string[]>>;
  };
}