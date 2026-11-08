# `lib/supabase/` — Client Factories

## Purpose

Three factory functions return configured Supabase JS clients tailored for three distinct execution contexts: **browser**, **server**, and **public anonymous reads**. They share configuration (URL + anon key) sourced from environment variables, falling back to dummy values when unavailable.

---

## Interfaces

### `client.ts`

```ts
/** Creates a @supabase/ssr browser client using cookie-aware sessions. */
function createClient(): ReturnType<typeof createBrowserClient>
```

- **Context**: Client-side pages / components (CSR).
- **Runtime**: `@supabase/ssr` → `createBrowserClient(url, anonKey)`.
- **Session**: Persists tokens in cookies automatically.
- **Environment**: Reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### `server.ts`

```ts
/** Creates a @supabase/ssr server client with access to request cookies. */
async function createServerSupabaseClient(): Promise<ReturnType<typeof createServerClient>>
```

- **Context**: Server Components, route handlers (`app/api/**`), middleware.
- **Runtime**: `@supabase/ssr` → `createServerClient(url, anonKey, { cookies })`.
- **Cookies**: Wraps `next/headers().cookies()` — `getAll` / `setAll` proxies supplied.
- **Error handling**: `setAll` swallows errors when called from Server Components (sessions refreshed via middleware instead).
- **Environment**: Same env vars as `client.ts`.

### `public.ts`

```ts
/** Creates an anonymized @supabase/supabase-js client with sessions disabled. */
function createPublicSupabaseClient(): ReturnType<typeof createClient>
```

- **Context**: Public menu lookups served from Edge CDN / ISR. No authentication.
- **Runtime**: Bare `@supabase/supabase-js` → `createClient(url, anonKey, options)`.
- **Configuration**: `{ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }` — ensures zero overhead on unauthenticated requests.
- **Environment**: Same env vars. When Supabase URL does not contain `.supabase.co`, returns the dummy client (triggers local/demo fallbacks in callers).

---

## Contracts

| Contract | Detail |
|---|---|
| **Always returns a valid client** | Even if env vars are dummy/falsy, a functional (no-op against real DB) client is returned. Callers guard downstream logic with env checks. |
| **Idempotent** | Each call independently constructs a fresh client from current env var values. No singleton caching. |
| **Non-blocking init** | `createServerSupabaseClient` is `async` because `await cookies()` is async; others are sync. |
| **No shared state** | Clients are independent per-call. No connection pooling or reuse guarantees from this layer. |

---

## Dependencies

```
client.ts    → @supabase/ssr    (createBrowserClient)
server.ts    → @supabase/ssr    (createServerClient) + next/headers
public.ts    → @supabase/supabase-js (createClient)
```

---

## Invariants & Side Effects

- **Invariant**: All three factories read exclusively from process environment; they do not mutate any external state.
- **Side effect**: None at construction time. Network activity occurs only when the caller executes Supabase queries.
- **Security note**: All three use the **anon/public** key — never the service-role key. Authz/RLS policies handle row-level security in the database.
