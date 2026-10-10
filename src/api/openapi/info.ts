export const OPENAPI_SERVERS = [
  {
    url: 'http://localhost:8082',
    description: 'Local (bun backend / api on VITE web port)',
  },
  {
    url: 'https://staging-api.straightup.tax',
    description:
      'Staging api (Scalar /docs hosted here; Cloudflare Access gates /docs only)',
  },
  {
    url: 'https://api.straightup.tax',
    description: 'Production api (no public /docs)',
  },
]

export const OPENAPI_TAGS: Array<{ name: string; description: string }> = [
  {
    name: 'auth',
    description:
      'Better Auth session lifecycle used by the app (email OTP sign-in, session, sign-out).',
  },
  {
    name: 'meta',
    description: 'Health, handshake, and other non-domain meta endpoints.',
  },
  { name: 'health', description: 'Liveness / deploy identity.' },
  { name: 'users', description: 'Current user profile and business settings.' },
  {
    name: 'transactions',
    description: 'List and mutate MTD transactions.',
  },
  { name: 'notifications', description: 'In-app notifications.' },
  { name: 'devices', description: 'Device registration and push tokens.' },
  {
    name: 'submissions',
    description: 'Quarterly HMRC submit, job enqueue, and summaries.',
  },
  { name: 'events', description: 'Authenticated server-sent events for live updates.' },
  {
    name: 'bank-accounts',
    description: 'Bank account status, accounts, and transaction search.',
  },
  { name: 'hmrc', description: 'HMRC Making Tax Digital connection and obligations.' },
  { name: 'mileage', description: 'Mileage expense entries.' },
  {
    name: 'categorisation',
    description: 'Merchant categorisation rules and review stats.',
  },
  {
    name: 'merchant',
    description: 'Per-user merchant fingerprint learning from corrected OCR suggestions.',
  },
  {
    name: 'file',
    description: 'Authenticated file upload (receipts and generic objects).',
  },
  {
    name: 'inbox',
    description: 'Inbound email documents waiting to be processed in the app.',
  },
  { name: 'stats', description: 'Anonymous product analytics proxy.' },
  {
    name: 'engine',
    description:
      'Growth engine: workspaces, brand kits, contacts, revenue, connectors, events and audit log.',
  },
]

// no markdown # headings — scalar turns those into sidebar entries and crowds out routes.
// keep the prose on the introduction page with bold labels instead.
export const OPENAPI_INFO_DESCRIPTION = `
HTTP API for the Straight Up Tax app. This document covers the **full api-service surface** served by the standalone API process (see route manifest).

**Versioning**

- Paths are unversioned under \`/api/*\`. Clients send \`x-app-version\` (or \`appVersion\` query) to \`GET /api/handshake\`, which returns numeric \`apiContract\` and \`status\` (\`ok\` | \`deprecated\` | \`blocked\`).
- Incompatible request/response shape changes bump \`apiContract\`; URL prefixes like \`/api/v2\` are reserved for a future deliberate cutover.

**Authentication** (mirrors the app)

Product auth is **email OTP** (not email/password):

1. Send a code: \`POST /api/auth/email-otp/send-verification-otp\` with \`{ "email", "type": "sign-in" }\`.
2. Sign in: \`POST /api/auth/sign-in/email-otp\` with \`{ "email", "otp" }\`. New emails are registered on success.
3. Call protected routes with either:
   - **Bearer (preferred for Try it / Postman / curl):** \`Authorization: Bearer <token>\` where \`token\` comes from the OTP sign-in / session payload (native app path via Better Auth bearer plugin).
   - **Cookie (web):** session cookie \`better-auth.session_token\` when the client stores cookies.
4. Inspect session: \`GET /api/auth/get-session\`.
5. Sign out: \`POST /api/auth/sign-out\`.

Sign-in may be disabled in some environments. Staging \`/docs\` Cloudflare Access is **separate** from API session auth — Access only gates the docs UI.

**Trying calls**

Pick a server above, authenticate, then call any authed operation. Prefer Bearer for non-browser clients.
`.trim()
