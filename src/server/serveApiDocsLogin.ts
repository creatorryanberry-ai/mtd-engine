import { APP_NAME } from '~/constants/app'

/** public landing (outside cloudflare access /docs*) — sign-in CTA into the docs. */
export function serveApiDocsLogin(request: Request): Response | null {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null

  const { pathname } = new URL(request.url)
  if (pathname !== '/login' && pathname !== '/login/') return null

  const headers = { 'content-type': 'text/html; charset=utf-8' }
  if (request.method === 'HEAD') {
    return new Response(null, { status: 200, headers })
  }
  return new Response(loginHtml(), { status: 200, headers })
}

function loginHtml(): string {
  // tokens match scalar's default theme (light/dark) — see
  // https://scalar.com/products/api-references/themes
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sign in — ${APP_NAME} API</title>
    <style>
      :root {
        color-scheme: light dark;
        --scalar-color-1: #121212;
        --scalar-color-2: rgba(0, 0, 0, 0.6);
        --scalar-color-3: rgba(0, 0, 0, 0.4);
        --scalar-color-accent: #0a85d1;
        --scalar-background-1: #fff;
        --scalar-background-2: #f6f5f4;
        --scalar-background-3: #f1ede9;
        --scalar-border-color: rgba(0, 0, 0, 0.08);
        --scalar-radius: 8px;
        --scalar-font: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --scalar-color-1: rgba(255, 255, 255, 0.81);
          --scalar-color-2: rgba(255, 255, 255, 0.443);
          --scalar-color-3: rgba(255, 255, 255, 0.282);
          --scalar-color-accent: #8ab4f8;
          --scalar-background-1: #202020;
          --scalar-background-2: #272727;
          --scalar-background-3: #333333;
          --scalar-border-color: rgba(255, 255, 255, 0.08);
        }
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        min-height: 100%;
        font-family: var(--scalar-font);
        background: var(--scalar-background-1);
        color: var(--scalar-color-1);
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
      }
      main {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 2rem 1.25rem;
        background: var(--scalar-background-2);
      }
      .card {
        width: min(26rem, 100%);
        padding: 2rem 1.75rem;
        border: 1px solid var(--scalar-border-color);
        border-radius: var(--scalar-radius);
        background: var(--scalar-background-1);
      }
      .brand {
        margin: 0 0 0.5rem;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--scalar-color-3);
      }
      h1 {
        margin: 0 0 0.5rem;
        font-size: 1.5rem;
        font-weight: 600;
        line-height: 1.25;
        letter-spacing: -0.02em;
        color: var(--scalar-color-1);
      }
      p {
        margin: 0 0 1.5rem;
        color: var(--scalar-color-2);
        font-size: 0.95rem;
      }
      a.cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.65rem 1rem;
        border-radius: var(--scalar-radius);
        background: var(--scalar-color-accent);
        color: #fff;
        text-decoration: none;
        font-size: 0.9rem;
        font-weight: 600;
      }
      a.cta:hover { filter: brightness(1.05); }
      .hint {
        margin: 1.1rem 0 0;
        font-size: 0.8rem;
        color: var(--scalar-color-3);
      }
    </style>
  </head>
  <body>
    <main>
      <div class="card">
        <p class="brand">${APP_NAME}</p>
        <h1>API docs</h1>
        <p>Sign in with your curator.org.uk Google account to open the OpenAPI reference.</p>
        <a class="cta" href="/docs">Sign in with Google</a>
        <p class="hint">Only @curator.org.uk accounts are allowed.</p>
      </div>
    </main>
  </body>
</html>
`
}
