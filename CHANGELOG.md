# Changelog

## [Unreleased]

### Bug Fixes

#### `agents_manage`
- **`list_groups`**: Fixed 404 error — `/agents/:id/groups` does not exist in Freshdesk API v2. Now fetches agent to read `group_ids`, then resolves each via `GET /groups/:id`.
- **`list_roles`**: Same fix — resolves roles from agent's `role_ids` via `GET /roles/:id`.

#### `companies_manage`
- **`search`**: Fixed `VALIDATION_ERROR` — Freshdesk search API requires the query wrapped in double quotes. Removed unsupported `per_page` parameter. Updated schema description to document the only valid search field (`domain:`).
- **`list_contacts`**: Fixed 404 error — `/companies/:id/contacts` does not exist in Freshdesk API v2. Now uses `GET /contacts?company_id=:id`.

#### `contacts_manage`
- **`search`**: Fixed `VALIDATION_ERROR` — query now wrapped in double quotes. Removed unsupported `per_page` parameter.
- **`merge`**: Fixed 404 error — was incorrectly using `PUT /contacts/:id/merge`. Correct endpoint is `POST /contacts/merge` with `{ primary_contact_id, secondary_contact_ids }` in the request body.

#### `tickets_manage`
- **`search`**: Fixed `VALIDATION_ERROR` — query now wrapped in double quotes. Removed unsupported `per_page` parameter. Updated schema description with valid searchable fields and value mappings.

### Added

#### E2E Test Suite (`tests/e2e/freshdesk-tools.e2e.test.ts`)
- Standalone `tsx`-based test runner (avoids ts-jest + ESM hanging issues with Jest)
- Covers all 5 tools and 34 actions end-to-end against a real Freshdesk instance
- Uses timestamp-based unique emails to prevent 409 conflicts on reruns
- Soft-delete + hard-delete in cleanup to keep emails reusable
- Spawns MCP server as a subprocess via `StdioClientTransport` from the MCP SDK
- Run with: `npm run test:e2e`

### Notes
- **Search syntax**: Freshdesk search API requires the full query wrapped in double quotes (e.g. `"status:2"`). Field values use single quotes (e.g. `"email:'user@example.com'"`).
- **Hard delete contacts**: Freshdesk requires a contact to be soft-deleted before it can be permanently deleted.
- **Agent `list_groups` / `list_roles`**: Freshdesk does not expose `/agents/:id/groups` or `/agents/:id/roles` — these are derived by resolving `group_ids` / `role_ids` from the agent record.
