import { useEffect, useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { toastError, toastSuccess } from '~/features/engine/client/engineToast'
import {
  useCreateBrand,
  useEngineBrandKit,
  useEngineBrands,
  useImportBrandKit,
  useSaveBrandKit,
} from '~/features/engine/client/useEngineBrand'
import {
  ChipGroup,
  EngineCard,
  EnginePage,
  EngineSection,
  ErrorState,
  Field,
  HelpText,
  IconButton,
  LoadingState,
  StatusPill,
} from '~/features/engine/components/EngineUi'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { Input } from '~/interface/forms/Input'
import { TextArea } from '~/interface/forms/TextArea'
import { PlusIcon } from '~/interface/icons/phosphor/PlusIcon'
import { TrashIcon } from '~/interface/icons/phosphor/TrashIcon'

import type { UpsertBrandKitInput } from '~/features/engine/client/engineApi'
import type { EngineBrandDto, EngineBrandKitDto } from '~/features/engine/contract'

type AiDisclosure = 'none' | 'subtle' | 'explicit'

type ColorRow = { name: string; hex: string; role: string }
type ClaimRow = { claim: string; evidence: string; approved: boolean }
type PersonaRow = {
  id: string
  name: string
  summary: string
  painPoints: string
  goals: string
}

type KitForm = {
  logoUrl: string
  colors: ColorRow[]
  fontHeading: string
  fontBody: string
  toneOfVoice: string
  bannedWords: string
  claims: ClaimRow[]
  proofPoints: string[]
  personas: PersonaRow[]
  aiDisclosure: AiDisclosure
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

const AI_DISCLOSURE_OPTIONS: { id: AiDisclosure; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'subtle', label: 'Subtle' },
  { id: 'explicit', label: 'Explicit' },
]

let personaCounter = 0
function newPersonaId() {
  personaCounter += 1
  return `draft-persona-${Date.now()}-${personaCounter}`
}

const splitList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const joinList = (items: string[] | undefined) => (items ?? []).join(', ')

function emptyForm(): KitForm {
  return {
    logoUrl: '',
    colors: [],
    fontHeading: '',
    fontBody: '',
    toneOfVoice: '',
    bannedWords: '',
    claims: [],
    proofPoints: [],
    personas: [],
    aiDisclosure: 'subtle',
  }
}

function formFromKit(
  kit: Partial<EngineBrandKitDto> | UpsertBrandKitInput,
  base?: KitForm,
): KitForm {
  const current = base ?? emptyForm()
  const disclosure = kit.aiDisclosure
  return {
    logoUrl: kit.logoUrl ?? current.logoUrl,
    colors: kit.colors
      ? kit.colors.map((color) => ({
          name: color.name,
          hex: color.hex,
          role: color.role ?? '',
        }))
      : current.colors,
    fontHeading: kit.fonts?.heading ?? current.fontHeading,
    fontBody: kit.fonts?.body ?? current.fontBody,
    toneOfVoice: kit.toneOfVoice ?? current.toneOfVoice,
    bannedWords: kit.bannedWords ? joinList(kit.bannedWords) : current.bannedWords,
    claims: kit.claims ? kit.claims.map((claim) => ({ ...claim })) : current.claims,
    proofPoints: kit.proofPoints ? [...kit.proofPoints] : current.proofPoints,
    personas: kit.personas
      ? kit.personas.map((persona) => ({
          id: persona.id || newPersonaId(),
          name: persona.name,
          summary: persona.summary,
          painPoints: joinList(persona.painPoints),
          goals: joinList(persona.goals),
        }))
      : current.personas,
    aiDisclosure:
      disclosure === 'none' || disclosure === 'subtle' || disclosure === 'explicit'
        ? disclosure
        : current.aiDisclosure,
  }
}

function formToInput(form: KitForm): UpsertBrandKitInput {
  return {
    logoUrl: form.logoUrl.trim() || null,
    colors: form.colors
      .filter((color) => HEX_RE.test(color.hex.trim()))
      .map((color) => ({
        name: color.name.trim() || 'Untitled',
        hex: color.hex.trim(),
        ...(color.role.trim() ? { role: color.role.trim() } : {}),
      })),
    fonts: {
      ...(form.fontHeading.trim() ? { heading: form.fontHeading.trim() } : {}),
      ...(form.fontBody.trim() ? { body: form.fontBody.trim() } : {}),
    },
    toneOfVoice: form.toneOfVoice.trim() || null,
    bannedWords: splitList(form.bannedWords),
    claims: form.claims
      .filter((claim) => claim.claim.trim())
      .map((claim) => ({
        claim: claim.claim.trim(),
        evidence: claim.evidence.trim(),
        approved: claim.approved,
      })),
    proofPoints: form.proofPoints.map((point) => point.trim()).filter(Boolean),
    personas: form.personas
      .filter((persona) => persona.name.trim())
      .map((persona) => ({
        id: persona.id,
        name: persona.name.trim(),
        summary: persona.summary.trim(),
        painPoints: splitList(persona.painPoints),
        goals: splitList(persona.goals),
      })),
    aiDisclosure: form.aiDisclosure,
  }
}

function RemoveButton({ onPress }: { onPress: () => void }) {
  return (
    <IconButton label="Remove" onPress={onPress}>
      <TrashIcon size={16} color={MTD_TOKENS.textSubtle} />
    </IconButton>
  )
}

function AddRowButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <MtdActionButton
      size="compact"
      variant="secondary"
      self="flex-start"
      icon={<PlusIcon size={14} color={MTD_TOKENS.text} />}
      onPress={onPress}
    >
      {label}
    </MtdActionButton>
  )
}

function Swatch({ hex }: { hex: string }) {
  const valid = HEX_RE.test(hex.trim())
  return (
    <YStack
      width={36}
      height={36}
      rounded="$3"
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      bg={valid ? (hex.trim() as never) : MTD_TOKENS.cardInset}
      shrink={0}
    />
  )
}

function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <XStack
      px="$2.5"
      py="$1.5"
      rounded="$10"
      borderWidth={1}
      borderColor={value ? MTD_TOKENS.green : MTD_TOKENS.cardBorder}
      cursor="pointer"
      pressStyle={{ opacity: 0.85 }}
      onPress={() => onChange(!value)}
      self="flex-start"
    >
      <SizableText
        fontSize={12}
        fontWeight="600"
        color={value ? MTD_TOKENS.green : MTD_TOKENS.textMuted}
      >
        {label}
      </SizableText>
    </XStack>
  )
}

function CreateBrandCard({ workspaceId }: { workspaceId: string }) {
  const create = useCreateBrand(workspaceId)
  const [name, setName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const canSave = name.trim().length > 0 && !create.isPending

  const submit = async () => {
    if (!canSave) return
    try {
      await create.mutateAsync({
        name: name.trim(),
        websiteUrl: websiteUrl.trim() || null,
        isDefault: true,
      })
      toastSuccess('Brand created')
    } catch (error) {
      toastError(error, 'Failed to create brand')
    }
  }

  return (
    <EngineCard p="$4" gap="$4" maxW={520}>
      <YStack gap="$1">
        <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
          Add your brand
        </SizableText>
        <HelpText>The brand kit, claims and personas hang off a brand.</HelpText>
      </YStack>
      <Field label="Brand name">
        <Input
          width="100%"
          placeholder="Northstar Roofing"
          value={name}
          onChangeText={setName}
        />
      </Field>
      <Field label="Website (optional)">
        <Input
          width="100%"
          placeholder="https://example.com"
          value={websiteUrl}
          onChangeText={setWebsiteUrl}
          autoCapitalize="none"
          inputMode="url"
        />
      </Field>
      <XStack justify="flex-end">
        <MtdActionButton
          disabled={!canSave}
          loading={create.isPending}
          onPress={() => void submit()}
        >
          Create brand
        </MtdActionButton>
      </XStack>
    </EngineCard>
  )
}

function BrandKitEditor({
  workspaceId,
  brand,
}: {
  workspaceId: string
  brand: EngineBrandDto
}) {
  const { kit, isLoading, isError, error } = useEngineBrandKit(workspaceId, brand.id)
  const save = useSaveBrandKit(workspaceId, brand.id)
  const importKit = useImportBrandKit(workspaceId, brand.id)
  const [form, setForm] = useState<KitForm>(emptyForm)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [draftFrom, setDraftFrom] = useState<string | null>(null)
  const [importUrl, setImportUrl] = useState(brand.websiteUrl ?? '')

  useEffect(() => {
    if (!kit) return
    const key = `${kit.id}:${kit.version}`
    if (key === loadedKey) return
    setForm(formFromKit(kit))
    setLoadedKey(key)
    setDraftFrom(null)
  }, [kit, loadedKey])

  const patch = (next: Partial<KitForm>) =>
    setForm((current) => ({ ...current, ...next }))

  const updateColor = (index: number, next: Partial<ColorRow>) =>
    patch({
      colors: form.colors.map((row, i) => (i === index ? { ...row, ...next } : row)),
    })
  const updateClaim = (index: number, next: Partial<ClaimRow>) =>
    patch({
      claims: form.claims.map((row, i) => (i === index ? { ...row, ...next } : row)),
    })
  const updatePersona = (index: number, next: Partial<PersonaRow>) =>
    patch({
      personas: form.personas.map((row, i) => (i === index ? { ...row, ...next } : row)),
    })
  const updateProof = (index: number, value: string) =>
    patch({ proofPoints: form.proofPoints.map((row, i) => (i === index ? value : row)) })
  const removeAt = <T,>(rows: T[], index: number) => rows.filter((_, i) => i !== index)

  const runImport = async () => {
    const url = importUrl.trim()
    if (!url || importKit.isPending) return
    try {
      const result = await importKit.mutateAsync({ websiteUrl: url })
      setForm((current) => formFromKit(result.draft, current))
      setDraftFrom(result.sourceUrl || url)
      toastSuccess('Draft imported. Review, then save.')
    } catch (err) {
      toastError(err, 'Failed to import from website')
    }
  }

  const runSave = async () => {
    if (save.isPending) return
    const invalid = form.colors.find(
      (color) => color.hex.trim() && !HEX_RE.test(color.hex.trim()),
    )
    if (invalid) {
      toastError(
        new Error(`"${invalid.hex}" is not a 6 digit hex colour`),
        'Invalid colour',
      )
      return
    }
    try {
      const saved = await save.mutateAsync(formToInput(form))
      setDraftFrom(null)
      toastSuccess(`Brand kit saved as version ${saved.version}`)
    } catch (err) {
      toastError(err, 'Failed to save brand kit')
    }
  }

  if (isLoading) return <LoadingState label="Loading brand kit…" />
  if (isError) {
    return (
      <EngineCard>
        <ErrorState error={error} />
      </EngineCard>
    )
  }

  return (
    <YStack gap="$5">
      <EngineCard p="$3.5" gap="$3">
        <XStack items="center" justify="space-between" gap="$3" flexWrap="wrap">
          <YStack gap="$0.5">
            <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
              Import from website
            </SizableText>
            <HelpText>
              The LLM drafts colours, tone, claims and personas. Nothing is saved until
              you press Save.
            </HelpText>
          </YStack>
          {kit ? <StatusPill label={`version ${kit.version}`} tone="muted" /> : null}
        </XStack>
        <XStack gap="$2" items="center" flexWrap="wrap">
          <YStack flex={1} minW={220}>
            <Input
              width="100%"
              placeholder="https://example.com"
              value={importUrl}
              onChangeText={setImportUrl}
              autoCapitalize="none"
              inputMode="url"
              onSubmitEditing={() => void runImport()}
            />
          </YStack>
          <MtdActionButton
            variant="secondary"
            loading={importKit.isPending}
            disabled={!importUrl.trim()}
            onPress={() => void runImport()}
          >
            Import
          </MtdActionButton>
        </XStack>
      </EngineCard>

      {draftFrom ? (
        <EngineCard p="$3" borderColor={MTD_TOKENS.blue}>
          <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.blue}>
            Draft from {draftFrom}, review then save
          </SizableText>
        </EngineCard>
      ) : null}

      <EngineSection title="Identity">
        <EngineCard p="$3.5" gap="$3.5">
          <Field label="Logo URL">
            <Input
              width="100%"
              placeholder="https://example.com/logo.svg"
              value={form.logoUrl}
              onChangeText={(logoUrl) => patch({ logoUrl })}
              autoCapitalize="none"
              inputMode="url"
            />
          </Field>
          <XStack gap="$3" flexWrap="wrap">
            <Field label="Heading font">
              <Input
                width="100%"
                placeholder="Inter"
                value={form.fontHeading}
                onChangeText={(fontHeading) => patch({ fontHeading })}
              />
            </Field>
            <Field label="Body font">
              <Input
                width="100%"
                placeholder="Inter"
                value={form.fontBody}
                onChangeText={(fontBody) => patch({ fontBody })}
              />
            </Field>
          </XStack>
        </EngineCard>
      </EngineSection>

      <EngineSection title="Colours">
        <EngineCard p="$3.5" gap="$3">
          {form.colors.length === 0 ? <HelpText>No colours yet.</HelpText> : null}
          {form.colors.map((color, index) => (
            <XStack key={index} gap="$2" items="center">
              <Swatch hex={color.hex} />
              <YStack flex={2} minW={100}>
                <Input
                  width="100%"
                  placeholder="Primary"
                  value={color.name}
                  onChangeText={(name) => updateColor(index, { name })}
                />
              </YStack>
              <YStack flex={1} minW={100}>
                <Input
                  width="100%"
                  placeholder="#F97316"
                  value={color.hex}
                  onChangeText={(hex) => updateColor(index, { hex })}
                  autoCapitalize="none"
                  fontFamily="$mono"
                />
              </YStack>
              <YStack flex={1} minW={90} display="none" $md={{ display: 'flex' }}>
                <Input
                  width="100%"
                  placeholder="role"
                  value={color.role}
                  onChangeText={(role) => updateColor(index, { role })}
                />
              </YStack>
              <RemoveButton
                onPress={() => patch({ colors: removeAt(form.colors, index) })}
              />
            </XStack>
          ))}
          <AddRowButton
            label="Add colour"
            onPress={() =>
              patch({ colors: [...form.colors, { name: '', hex: '', role: '' }] })
            }
          />
        </EngineCard>
      </EngineSection>

      <EngineSection title="Voice">
        <EngineCard p="$3.5" gap="$3.5">
          <Field label="Tone of voice">
            <TextArea
              width="100%"
              placeholder="Plain spoken, confident, never salesy."
              value={form.toneOfVoice}
              onChangeText={(toneOfVoice) => patch({ toneOfVoice })}
              numberOfLines={4}
            />
          </Field>
          <Field label="Banned words (comma separated)">
            <Input
              width="100%"
              placeholder="cheap, guaranteed, best"
              value={form.bannedWords}
              onChangeText={(bannedWords) => patch({ bannedWords })}
              autoCapitalize="none"
            />
          </Field>
          <Field label="AI disclosure">
            <ChipGroup
              options={AI_DISCLOSURE_OPTIONS}
              value={form.aiDisclosure}
              onChange={(aiDisclosure) => patch({ aiDisclosure })}
            />
          </Field>
        </EngineCard>
      </EngineSection>

      <EngineSection title="Claims">
        <EngineCard p="$3.5" gap="$3">
          <HelpText>
            Only approved claims with evidence can be used in generated copy.
          </HelpText>
          {form.claims.map((claim, index) => (
            <YStack key={index} gap="$2" p="$3" rounded="$3" bg={MTD_TOKENS.cardInset}>
              <XStack gap="$2" items="center">
                <YStack flex={1}>
                  <Input
                    width="100%"
                    placeholder="Claim"
                    value={claim.claim}
                    onChangeText={(value) => updateClaim(index, { claim: value })}
                  />
                </YStack>
                <RemoveButton
                  onPress={() => patch({ claims: removeAt(form.claims, index) })}
                />
              </XStack>
              <Input
                width="100%"
                placeholder="Evidence (link, stat, certificate)"
                value={claim.evidence}
                onChangeText={(evidence) => updateClaim(index, { evidence })}
              />
              <Toggle
                value={claim.approved}
                onChange={(approved) => updateClaim(index, { approved })}
                label={claim.approved ? 'Approved' : 'Not approved'}
              />
            </YStack>
          ))}
          <AddRowButton
            label="Add claim"
            onPress={() =>
              patch({
                claims: [...form.claims, { claim: '', evidence: '', approved: false }],
              })
            }
          />
        </EngineCard>
      </EngineSection>

      <EngineSection title="Proof points">
        <EngineCard p="$3.5" gap="$3">
          {form.proofPoints.map((point, index) => (
            <XStack key={index} gap="$2" items="center">
              <YStack flex={1}>
                <Input
                  width="100%"
                  placeholder="Rated 4.9 from 312 reviews"
                  value={point}
                  onChangeText={(value) => updateProof(index, value)}
                />
              </YStack>
              <RemoveButton
                onPress={() => patch({ proofPoints: removeAt(form.proofPoints, index) })}
              />
            </XStack>
          ))}
          <AddRowButton
            label="Add proof point"
            onPress={() => patch({ proofPoints: [...form.proofPoints, ''] })}
          />
        </EngineCard>
      </EngineSection>

      <EngineSection title="Personas">
        <EngineCard p="$3.5" gap="$3">
          {form.personas.map((persona, index) => (
            <YStack
              key={persona.id}
              gap="$2"
              p="$3"
              rounded="$3"
              bg={MTD_TOKENS.cardInset}
            >
              <XStack gap="$2" items="center">
                <YStack flex={1}>
                  <Input
                    width="100%"
                    placeholder="Persona name"
                    value={persona.name}
                    onChangeText={(name) => updatePersona(index, { name })}
                  />
                </YStack>
                <RemoveButton
                  onPress={() => patch({ personas: removeAt(form.personas, index) })}
                />
              </XStack>
              <TextArea
                size="small"
                width="100%"
                placeholder="Summary"
                value={persona.summary}
                onChangeText={(summary) => updatePersona(index, { summary })}
                numberOfLines={3}
              />
              <XStack gap="$2" flexWrap="wrap">
                <Field label="Pain points (comma separated)">
                  <Input
                    width="100%"
                    value={persona.painPoints}
                    onChangeText={(painPoints) => updatePersona(index, { painPoints })}
                  />
                </Field>
                <Field label="Goals (comma separated)">
                  <Input
                    width="100%"
                    value={persona.goals}
                    onChangeText={(goals) => updatePersona(index, { goals })}
                  />
                </Field>
              </XStack>
            </YStack>
          ))}
          <AddRowButton
            label="Add persona"
            onPress={() =>
              patch({
                personas: [
                  ...form.personas,
                  {
                    id: newPersonaId(),
                    name: '',
                    summary: '',
                    painPoints: '',
                    goals: '',
                  },
                ],
              })
            }
          />
        </EngineCard>
      </EngineSection>

      <XStack justify="flex-end" gap="$2" items="center">
        {kit ? (
          <HelpText>
            Saving creates version {kit.version + 1} and writes an audit entry.
          </HelpText>
        ) : null}
        <MtdActionButton loading={save.isPending} onPress={() => void runSave()}>
          Save brand kit
        </MtdActionButton>
      </XStack>
    </YStack>
  )
}

export function EngineBrandScreen({ workspaceId }: { workspaceId: string }) {
  const { brands, defaultBrand, isLoading, isError, error } = useEngineBrands(workspaceId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const brand = brands.find((item) => item.id === selectedId) ?? defaultBrand

  return (
    <EnginePage
      title="Brand kit"
      subtitle="The guardrails every generated asset is checked against."
      actions={
        brands.length > 1 ? (
          <ChipGroup
            options={brands.map((item) => ({ id: item.id, label: item.name }))}
            value={brand?.id ?? ''}
            onChange={setSelectedId}
          />
        ) : null
      }
    >
      {isLoading ? <LoadingState label="Loading brands…" /> : null}
      {isError ? (
        <EngineCard>
          <ErrorState error={error} />
        </EngineCard>
      ) : null}
      {!isLoading && !isError && workspaceId && !brand ? (
        <CreateBrandCard workspaceId={workspaceId} />
      ) : null}
      {workspaceId && brand ? (
        <BrandKitEditor key={brand.id} workspaceId={workspaceId} brand={brand} />
      ) : null}
    </EnginePage>
  )
}
