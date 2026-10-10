import { createApiReference } from '@scalar/api-reference'
import '@scalar/api-reference/style.css'
import { createNavigation } from '@scalar/workspace-store/navigation'

import rawSpec from '../src/api/openapi.json'

type Server = { url: string; description?: string }
type Operation = {
  tags?: string[]
  summary?: string
  description?: string
  servers?: Server[]
  [key: string]: unknown
}
type PathItem = Record<string, Operation | Server[] | undefined>
type TagObject = { name: string; description?: string; 'x-displayName'?: string }
type OpenApiDoc = {
  openapi?: string
  info?: { title?: string; version?: string; description?: string }
  servers?: Server[]
  tags?: TagObject[]
  paths?: Record<string, PathItem>
  'x-tagGroups'?: Array<{ name: string; tags: string[] }>
  'x-scalar-navigation'?: unknown
  [key: string]: unknown
}

type NavEntry = {
  type?: string
  name?: string
  title?: string
  method?: string
  isGroup?: boolean
  children?: NavEntry[]
  [key: string]: unknown
}

const HTTP_METHODS = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
])

function displayLabel(path: string) {
  if (path === '/' || path === '') return '.'
  return path.replace(/^\//, '')
}

/** sidebar route labels keep a leading slash (/me, /users) */
function withSlash(label: string) {
  if (label === '.' || label === '/') return '/'
  return label.startsWith('/') ? label : `/${label}`
}

function relativeToTag(fullPath: string, tag: string) {
  const prefix = `/api/${tag}`

  if (fullPath === prefix || fullPath.startsWith(`${prefix}/`)) {
    return { label: displayLabel(fullPath.slice(prefix.length) || '/') }
  }

  if (fullPath.startsWith('/api/')) {
    return { label: displayLabel(fullPath.slice('/api'.length)) }
  }

  return { label: displayLabel(fullPath) }
}

/** scalar http method accent colors (match sidebar badges) */
const METHOD_BADGE_COLOR: Record<string, string> = {
  get: 'var(--scalar-color-blue)',
  post: 'var(--scalar-color-green)',
  put: 'var(--scalar-color-orange)',
  patch: 'var(--scalar-color-yellow)',
  delete: 'var(--scalar-color-red)',
  options: 'var(--scalar-color-purple)',
  head: 'var(--scalar-color-2)',
  trace: 'var(--scalar-color-2)',
}

function methodBadge(method: string) {
  return {
    name: method.toUpperCase(),
    position: 'before' as const,
    color: METHOD_BADGE_COLOR[method.toLowerCase()] ?? 'var(--scalar-color-2)',
  }
}

/**
 * Scalar-only view:
 * - domain folders (/auth, /users, …) with tag descriptions
 * - path segments (/me, …) with descriptors derived from op summaries
 * - sidebar ops show GET/PATCH; main header is method badge + full /api/... route
 *
 * Note: x-tagGroups alone renders domains as non-collapsible sections. We build
 * navigation from tag groups, then promote groups to real tags via x-scalar-navigation.
 */
function forScalarDocs(spec: OpenApiDoc): OpenApiDoc {
  const docServers = spec.servers ?? [{ url: '' }]
  const domainOrder = (spec.tags ?? []).map((tag) => displayLabel(tag.name))
  const domainMeta = new Map(
    (spec.tags ?? []).map((tag) => [displayLabel(tag.name), tag] as const),
  )

  type Pending = {
    method: string
    domain: string
    label: string
    pathKey: string
    operation: Operation
  }

  const pending: Pending[] = []

  for (const [fullPath, pathItem] of Object.entries(spec.paths ?? {})) {
    if (!pathItem || typeof pathItem !== 'object') continue

    for (const [method, value] of Object.entries(pathItem)) {
      if (
        !HTTP_METHODS.has(method) ||
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value)
      ) {
        continue
      }
      const operation = value as Operation
      const domain = displayLabel(operation.tags?.[0] ?? 'other')
      const rel = relativeToTag(fullPath, operation.tags?.[0] ?? 'other')
      pending.push({
        method,
        domain,
        label: rel.label,
        // keep full /api/... path so the main panel shows the real route
        pathKey: fullPath,
        operation: { ...operation },
      })
    }
  }

  const paths: Record<string, PathItem> = {}
  const pathTagsByDomain = new Map<string, Set<string>>()
  const tagObjects = new Map<string, TagObject>()
  const leafSummaries = new Map<string, string[]>()

  for (const item of pending) {
    // root resource (e.g. /health) stays on the domain tag; otherwise nest under path label
    const uniqueLeaf = item.label === '.' ? item.domain : `${item.domain}::${item.label}`

    const humanSummary =
      typeof item.operation.summary === 'string' ? item.operation.summary.trim() : ''
    if (humanSummary) {
      const list = leafSummaries.get(uniqueLeaf) ?? []
      list.push(humanSummary)
      leafSummaries.set(uniqueLeaf, list)
    }

    if (!tagObjects.has(uniqueLeaf)) {
      if (item.label === '.') {
        const meta = domainMeta.get(item.domain)
        tagObjects.set(uniqueLeaf, {
          ...meta,
          name: uniqueLeaf,
          'x-displayName': withSlash(item.domain),
          description: meta?.description,
        })
      } else {
        tagObjects.set(uniqueLeaf, {
          name: uniqueLeaf,
          'x-displayName': withSlash(item.label),
        })
      }
    }

    const domainTags = pathTagsByDomain.get(item.domain) ?? new Set<string>()
    domainTags.add(uniqueLeaf)
    pathTagsByDomain.set(item.domain, domainTags)

    const originalDescription =
      typeof item.operation.description === 'string'
        ? item.operation.description.trim()
        : ''
    const descriptionParts = [
      humanSummary,
      originalDescription && originalDescription !== humanSummary
        ? originalDescription
        : '',
    ].filter(Boolean)

    const pathItem = (paths[item.pathKey] ??= {})
    pathItem[item.method] = {
      ...item.operation,
      tags: [uniqueLeaf],
      // main heading = full route; human summary stays in the description body
      summary: item.pathKey,
      description: descriptionParts.join('\n\n') || undefined,
      'x-badges': [methodBadge(item.method)],
      servers: docServers,
    }
  }

  // path-level tag descriptors from the ops under that route
  for (const [leaf, summaries] of leafSummaries) {
    const tag = tagObjects.get(leaf)
    if (!tag || tag.description) continue
    const unique = [...new Set(summaries)]
    tag.description = unique.join(' · ')
  }

  const xTagGroups = domainOrder
    .filter((domain) => pathTagsByDomain.has(domain))
    .map((domain) => ({
      name: withSlash(domain),
      description: domainMeta.get(domain)?.description,
      tags: [...pathTagsByDomain.get(domain)!],
    }))

  for (const domain of pathTagsByDomain.keys()) {
    if (!domainOrder.includes(domain)) {
      xTagGroups.push({
        name: withSlash(domain),
        description: domainMeta.get(domain)?.description,
        tags: [...pathTagsByDomain.get(domain)!],
      })
    }
  }

  const transformed: OpenApiDoc = {
    ...spec,
    tags: [...tagObjects.values()],
    paths,
    servers: docServers,
    'x-tagGroups': xTagGroups,
  }

  // build nav from summaries first, then rewrite op titles to verbs for the sidebar only
  const navigation = createNavigation('api', transformed, {
    hideModels: true,
    operationTitleSource: 'summary',
  }) as NavEntry

  // x-tagGroups build isGroup:true sections; promote to collapsible domain folders
  for (const entry of navigation.children ?? []) {
    if (entry.type !== 'tag' || !entry.isGroup) continue
    entry.isGroup = false

    // /health [domain] > /health [tag] > ops → /health > ops
    const onlyChild = entry.children?.[0]
    if (
      entry.children?.length === 1 &&
      onlyChild?.type === 'tag' &&
      (onlyChild.name === entry.name ||
        onlyChild.title === entry.title ||
        displayLabel(onlyChild.name ?? '') === displayLabel(entry.name ?? ''))
    ) {
      entry.children = onlyChild.children
    }
  }

  // sticky mobile header: "GET /api/users/me". sidebar hides this label via CSS
  // and only shows Scalar's method badge.
  setStickyOperationTitles(navigation.children)

  // keep x-tagGroups out of the live doc — navigation is the source of truth
  const { 'x-tagGroups': _drop, ...rest } = transformed
  return {
    ...rest,
    'x-scalar-navigation': navigation,
  }
}

function setStickyOperationTitles(entries: NavEntry[] | undefined) {
  for (const entry of entries ?? []) {
    if (entry.type === 'operation' && typeof entry.method === 'string') {
      const path =
        typeof entry.title === 'string' && entry.title.startsWith('/')
          ? entry.title
          : typeof entry.name === 'string' && entry.name.startsWith('/')
            ? entry.name
            : null
      if (path) {
        entry.title = `${entry.method.toUpperCase()} ${path}`
      }
    }
    if (entry.children?.length) setStickyOperationTitles(entry.children)
  }
}

/** move scalar x-badges into the operation title so they sit inline without indenting the panel */
function inlineMethodBadges(rootEl: ParentNode) {
  for (const section of rootEl.querySelectorAll('.section-content')) {
    if (!(section instanceof HTMLElement)) continue

    const layout = section.querySelector(':scope > .operation-layout')
    if (!layout) continue

    const title = layout.querySelector('.operation-title')
    if (!(title instanceof HTMLElement)) continue

    const badgeRow = section.querySelector(
      ':scope > .flex.flex-row.justify-between.gap-1',
    )
    if (title.querySelector(':scope > .badge')) {
      if (badgeRow instanceof HTMLElement) badgeRow.style.display = 'none'
      section.dataset.mtdBadgeInlined = '1'
      continue
    }
    if (section.dataset.mtdBadgeInlined === '1') continue

    const badge = badgeRow?.querySelector('.badge')
    if (!(badge instanceof HTMLElement)) continue

    title.prepend(badge)
    section.dataset.mtdBadgeInlined = '1'
    if (badgeRow instanceof HTMLElement) badgeRow.style.display = 'none'
  }
}

/**
 * hoist the human summary (first description paragraph) above the two-column
 * body so the examples panel lines up with the real description text.
 */
function hoistOperationSummaries(rootEl: ParentNode) {
  for (const layout of rootEl.querySelectorAll('.operation-layout')) {
    if (!(layout instanceof HTMLElement)) continue
    if (layout.dataset.mtdSummaryHoisted === '1') continue

    const desc = layout.querySelector(':scope > .operation-description')
    const title = layout.querySelector(':scope > .operation-title')
    if (!(desc instanceof HTMLElement) || !(title instanceof HTMLElement)) continue

    const firstP = desc.querySelector('.markdown > p:first-child')
    if (!(firstP instanceof HTMLElement)) continue
    // only hoist when a following body paragraph remains in the description column
    if (!(firstP.nextElementSibling instanceof HTMLElement)) continue

    const subtitle = document.createElement('div')
    subtitle.className = 'operation-summary'
    subtitle.append(firstP)
    title.after(subtitle)
    layout.dataset.mtdSummaryHoisted = '1'
  }
}

function polishOperationPanels(rootEl: ParentNode) {
  inlineMethodBadges(rootEl)
  hoistOperationSummaries(rootEl)
}

const root = document.getElementById('app')
if (!root) throw new Error('missing #app')

createApiReference(root, {
  spec: { content: forScalarDocs(rawSpec as OpenApiDoc) },
  // summary is rewritten to the full /api/... path for main panel headings
  operationTitleSource: 'summary',
  defaultOpenAllTags: false,
  defaultOpenFirstTag: false,
})

/** Vue 3 component instance attached to a DOM node (not in public typings). */
type VueInstance = {
  parent: VueInstance | null
  emit: (event: string, ...args: unknown[]) => void
  props: Record<string, unknown>
  type?: { __name?: string; name?: string }
}

type NavItem = {
  id?: string
  type?: string
  children?: NavItem[]
}

function vueInstance(el: Element): VueInstance | null {
  const raw = Reflect.get(el, '__vueParentComponent')
  if (!raw || typeof raw !== 'object') return null
  return raw as VueInstance
}

function componentName(inst: VueInstance): string | undefined {
  return inst.type?.__name ?? inst.type?.name
}

function sidebarItemFromButton(button: Element): VueInstance | null {
  let inst = vueInstance(button)
  while (inst && componentName(inst) !== 'SidebarItem') {
    inst = inst.parent
  }
  return inst
}

function navItemId(item: unknown): string | null {
  if (!item || typeof item !== 'object' || !('id' in item)) return null
  const id = Reflect.get(item, 'id')
  return typeof id === 'string' ? id : null
}

function firstOperationId(item: NavItem): string | null {
  if (item.type === 'operation' && typeof item.id === 'string') return item.id
  for (const child of item.children ?? []) {
    const found = firstOperationId(child)
    if (found) return found
  }
  return null
}

/**
 * Sidebar folder clicks:
 * - top-level domain: toggle open/close only
 * - nested route: jump to the first HTTP method under that route
 */
function wireSidebarFolderClicks(rootEl: HTMLElement) {
  rootEl.addEventListener(
    'click',
    (event) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const button = target.closest('.t-doc__sidebar button[aria-expanded]')
      if (!(button instanceof HTMLButtonElement)) return

      const folder = button.closest('[data-sidebar-id]')
      if (!(folder instanceof HTMLElement)) return

      const isTopLevel = !folder.parentElement?.closest('[data-sidebar-id]')
      const inst = sidebarItemFromButton(button)
      const item = inst?.props.item as NavItem | undefined
      const folderId = navItemId(item)
      if (!inst || !item || !folderId) return

      if (isTopLevel) {
        event.preventDefault()
        event.stopImmediatePropagation()
        inst.emit('toggleGroup', folderId)
        return
      }

      const operationId = firstOperationId(item)
      if (!operationId) return

      event.preventDefault()
      event.stopImmediatePropagation()
      // ensure the route folder is open, then select the first method
      if (button.getAttribute('aria-expanded') !== 'true') {
        inst.emit('toggleGroup', folderId)
      }
      inst.emit('selectItem', operationId)
    },
    true,
  )
}

wireSidebarFolderClicks(root)
polishOperationPanels(root)
const panelObserver = new MutationObserver(() => polishOperationPanels(root))
panelObserver.observe(root, { childList: true, subtree: true })

// cloudflare access session logout (staging). skipped on local bun api-docs.
// returnTo /login (public, outside /docs*) so google sso does not bounce
// straight back into the docs ui.
const host = location.hostname
if (host !== 'localhost' && host !== '127.0.0.1') {
  const returnTo = `${location.origin}/login`
  const logout = document.createElement('a')
  logout.className = 'access-logout'
  logout.href = `/cdn-cgi/access/logout?returnTo=${encodeURIComponent(returnTo)}`
  logout.textContent = 'Sign out'
  document.body.appendChild(logout)
}
