import { and, asc, desc, eq, ne } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { engineBrand, engineBrandKit } from '~/database/engineSchema'

import { newId } from '../ids'
import { userActor, writeAudit } from './audit'
import { httpError } from './httpError'

import type { EngineBrand, EngineBrandKit } from '~/database/engineSchema'

export type UpsertBrandInput = {
  name: string
  websiteUrl?: string | null
  industry?: string | null
  market?: 'b2b' | 'b2c' | 'both'
  isDefault?: boolean
}

export type UpsertBrandKitInput = {
  logoUrl?: string | null
  colors?: EngineBrandKit['colors']
  fonts?: EngineBrandKit['fonts']
  toneOfVoice?: string | null
  bannedWords?: string[]
  claims?: EngineBrandKit['claims']
  proofPoints?: string[]
  personas?: EngineBrandKit['personas']
  aiDisclosure?: 'none' | 'subtle' | 'explicit'
}

export async function listBrands(workspaceId: string): Promise<EngineBrand[]> {
  return drizzle
    .select()
    .from(engineBrand)
    .where(eq(engineBrand.workspaceId, workspaceId))
    .orderBy(desc(engineBrand.isDefault), asc(engineBrand.createdAt))
}

export async function getBrand(
  workspaceId: string,
  brandId: string,
): Promise<EngineBrand | null> {
  const [row] = await drizzle
    .select()
    .from(engineBrand)
    .where(and(eq(engineBrand.id, brandId), eq(engineBrand.workspaceId, workspaceId)))
    .limit(1)
  return row ?? null
}

async function clearOtherDefaults(workspaceId: string, keepBrandId: string) {
  await drizzle
    .update(engineBrand)
    .set({ isDefault: false, updatedAt: new Date().toISOString() })
    .where(and(eq(engineBrand.workspaceId, workspaceId), ne(engineBrand.id, keepBrandId)))
}

export async function createBrand(
  workspaceId: string,
  userId: string,
  input: UpsertBrandInput,
  ipAddress: string | null = null,
): Promise<EngineBrand> {
  const id = newId('br')
  const [brand] = await drizzle
    .insert(engineBrand)
    .values({
      id,
      workspaceId,
      name: input.name.trim(),
      websiteUrl: input.websiteUrl ?? null,
      industry: input.industry ?? null,
      market: input.market ?? 'b2b',
      isDefault: input.isDefault ?? false,
    })
    .returning()
  if (!brand) throw httpError(500, 'Brand not created')
  if (brand.isDefault) await clearOtherDefaults(workspaceId, id)

  // the first brand kit version is empty so the kit route always has something to return
  await drizzle
    .insert(engineBrandKit)
    .values({ id: newId('bk'), workspaceId, brandId: id, version: 1 })

  await writeAudit({
    workspaceId,
    actor: userActor(userId),
    action: 'brand.create',
    entityType: 'brand',
    entityId: id,
    after: toBrandAudit(brand),
    reasoning: 'brand created by user',
    ipAddress,
  })
  return brand
}

export async function updateBrand(
  workspaceId: string,
  userId: string,
  brandId: string,
  input: Partial<UpsertBrandInput>,
  ipAddress: string | null = null,
): Promise<EngineBrand> {
  const before = await getBrand(workspaceId, brandId)
  if (!before) throw httpError(404, 'Brand not found')

  const patch: Partial<typeof engineBrand.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  }
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.websiteUrl !== undefined) patch.websiteUrl = input.websiteUrl
  if (input.industry !== undefined) patch.industry = input.industry
  if (input.market !== undefined) patch.market = input.market
  if (input.isDefault !== undefined) patch.isDefault = input.isDefault

  const [after] = await drizzle
    .update(engineBrand)
    .set(patch)
    .where(and(eq(engineBrand.id, brandId), eq(engineBrand.workspaceId, workspaceId)))
    .returning()
  if (!after) throw httpError(404, 'Brand not found')
  if (after.isDefault && !before.isDefault) await clearOtherDefaults(workspaceId, brandId)

  await writeAudit({
    workspaceId,
    actor: userActor(userId),
    action: 'brand.update',
    entityType: 'brand',
    entityId: brandId,
    before: toBrandAudit(before),
    after: toBrandAudit(after),
    reasoning: 'brand updated by user',
    ipAddress,
  })
  return after
}

export async function getCurrentBrandKit(
  workspaceId: string,
  brandId: string,
): Promise<EngineBrandKit | null> {
  const [row] = await drizzle
    .select()
    .from(engineBrandKit)
    .where(
      and(
        eq(engineBrandKit.brandId, brandId),
        eq(engineBrandKit.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(engineBrandKit.version))
    .limit(1)
  return row ?? null
}

/** every save is a new immutable version; omitted fields carry over from the current one */
export async function putBrandKit(
  workspaceId: string,
  userId: string,
  brandId: string,
  input: UpsertBrandKitInput,
  ipAddress: string | null = null,
): Promise<EngineBrandKit> {
  const brand = await getBrand(workspaceId, brandId)
  if (!brand) throw httpError(404, 'Brand not found')
  const current = await getCurrentBrandKit(workspaceId, brandId)

  const [kit] = await drizzle
    .insert(engineBrandKit)
    .values({
      id: newId('bk'),
      workspaceId,
      brandId,
      version: (current?.version ?? 0) + 1,
      logoUrl: input.logoUrl !== undefined ? input.logoUrl : (current?.logoUrl ?? null),
      colors: input.colors ?? current?.colors ?? [],
      fonts: input.fonts ?? current?.fonts ?? {},
      toneOfVoice:
        input.toneOfVoice !== undefined
          ? input.toneOfVoice
          : (current?.toneOfVoice ?? null),
      bannedWords: input.bannedWords ?? current?.bannedWords ?? [],
      claims: input.claims ?? current?.claims ?? [],
      proofPoints: input.proofPoints ?? current?.proofPoints ?? [],
      personas: input.personas ?? current?.personas ?? [],
      aiDisclosure: input.aiDisclosure ?? current?.aiDisclosure ?? 'subtle',
    })
    .returning()
  if (!kit) throw httpError(500, 'Brand kit not saved')

  await writeAudit({
    workspaceId,
    actor: userActor(userId),
    action: 'brand_kit.save',
    entityType: 'brand_kit',
    entityId: kit.id,
    before: current ? toKitAudit(current) : null,
    after: toKitAudit(kit),
    reasoning: `brand kit version ${kit.version} saved by user`,
    ipAddress,
  })
  return kit
}

function toBrandAudit(brand: EngineBrand): Record<string, unknown> {
  return {
    name: brand.name,
    websiteUrl: brand.websiteUrl,
    industry: brand.industry,
    market: brand.market,
    isDefault: brand.isDefault,
  }
}

function toKitAudit(kit: EngineBrandKit): Record<string, unknown> {
  return {
    version: kit.version,
    logoUrl: kit.logoUrl,
    colors: kit.colors,
    fonts: kit.fonts,
    toneOfVoice: kit.toneOfVoice,
    bannedWords: kit.bannedWords,
    claims: kit.claims,
    proofPoints: kit.proofPoints,
    personas: kit.personas,
    aiDisclosure: kit.aiDisclosure,
  }
}
