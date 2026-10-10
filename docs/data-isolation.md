---
name: data-isolation
description: How Straight Up Tax separates user tax data — per-user rows, API auth scoping, Postgres RLS, encryption, private receipts.
---

# Data isolation

Straight Up Tax stores all customers in one shared PostgreSQL database per environment. Isolation is per user account (`userId`), not organisation or tenant multi-tenancy. There is no `tenantId` column and no separate schema or database per customer. Staging and production use separate databases; that is environment isolation, not user isolation.

## How a request is scoped

Handlers authenticate with better-auth (cookie session on web, Bearer token on native) via `requireAuth`, `requireApiAuth`, or `ensureAuth`. Those helpers call `enterUserDbContext(userId)` so the rest of the request’s async work is bound to that user.

Services then filter with `eq(table.userId, sessionUserId)`, and mutations typically require both resource id and `userId`. Client-supplied `userId` values are never used for ownership.

On top of that, Postgres row-level security is enabled (and forced) on user-scoped tables. Policies allow a row only when `"userId" = current_setting('app.user_id')`, or when `app.bypass_rls = on`. The connection pool applies those session settings on every checkout from AsyncLocalStorage. Bypass stays on for migrations, better-auth’s own tables/flows, and job bootstrap before a job’s `userId` is known. Background jobs then run under `runWithUserDbContextAsync(userId, …)`.

Relevant code: `packages/database/src/userContext.ts`, `packages/database/src/wrapPoolWithRls.ts`, and the `enable-user-rls` migration.

## What is encrypted

HMRC OAuth tokens, and National Insurance numbers on `hmrcConnection` / `hmrcOAuthState`, are encrypted at rest with AES-256-GCM keyed from `BETTER_AUTH_SECRET`. The connection status API returns only the last four characters of a NINO for display. Transaction amounts, categories, and submission payloads are not field-encrypted.

## Receipts

Receipt images upload through `POST /api/file/receipt`. Staging and production require `GCS_RECEIPTS_BUCKET` and `GCS_SERVICE_ACCOUNT_JSON` — objects go to a private Google Cloud Storage bucket. Local/dev falls back to private MinIO with signed URLs when GCS is unset. Keys are always under `receipts/{userId}/…`.

The database stores a stable ref `mtd-receipt:{key}`, not a permanent public URL. List/detail APIs expand a short-lived signed URL only for the owning user. Avatars and other non-receipt uploads go through `/api/file/upload`: MinIO locally, or public GCS objects under `uploads/` / `avatars/` in staging/production (same `GCS_*` credentials; objects are stored with a public ACL and a permanent `storage.googleapis.com` URL on `user.image`).

## Admin and impersonation

There is no password sign-in path; product auth is email OTP only. Better-auth’s `/api/auth/admin/*` HTTP surface (including impersonation) is always denied in the auth handler — staff admin is app-level only (`user.role = admin` and/or `ADMIN_EMAILS`). Impersonation can be re-enabled later behind a narrow, audited path.

`user.role = admin`, or emails listed in `ADMIN_EMAILS`, can call a small set of admin-gated endpoints (for example quarterly unsubmit). Those handlers still use `authData.id` — they do not browse another user’s tax data.

## Claims you can make

Via the product API, a signed-in user can only read and write their own tax, bank, mileage, submission, and receipt data. Other customers cannot access that data through the app.

“Neither we nor anyone else can ever see user data” is not a hard technical guarantee. Anyone with production database credentials, backups, or object-storage admin access can still reach underlying storage (tokens and NINOs encrypted; most tax rows plaintext). That side is operational access control: least-privilege credentials, audited access, and a private GCS bucket with no public ACL.

## Production / staging configuration

Set these for private Google receipts (required for TestFlight preview and production uploads) and optional admin allowlisting:

```
GCS_RECEIPTS_BUCKET=straightuptax-receipts
GCS_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
GCS_PROJECT_ID=           # optional if present in the JSON
ADMIN_EMAILS=ops@example.com
```

Leave the GCS vars empty in local development to keep using MinIO signed URLs. Prefer a separate staging bucket (e.g. `straightuptax-receipts-staging`) so preview data never shares the production bucket. Deploy so the RLS and NINO encrypt migrations have run (`enable-user-rls`, `encrypt-existing-ninos`, `reencrypt-ninos-with-rls-bypass`).

## Privacy copy

User-facing language for this model lives in the privacy policy (`app/(legal)/privacy-policy+ssg.tsx`), under data security and access to Making Tax Digital data.
