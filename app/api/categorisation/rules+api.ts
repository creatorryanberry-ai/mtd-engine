import { jsonError, requireAuth } from '~/server/apiHelpers'
import { getHmrcCategory } from '~/features/mtd/categories/hmrcCategories'
import {
  createCategorisationRule,
  clearCategorisationRulesForUser,
  deleteCategorisationRule,
  getRulesForUser,
  updateCategorisationRule,
  upsertRuleForMerchant,
} from '~/features/categorisation/server/categorisationService'
import { getHmrcCategoryLabel } from '~/features/mtd/categories/hmrcCategories'

import type { RuleMatchType } from '~/features/categorisation/categorisationMatching'
import type { Endpoint } from 'one'

function toRuleDto(rule: Awaited<ReturnType<typeof getRulesForUser>>[number]) {
  return {
    id: rule.id,
    matchField: rule.matchField,
    matchType: rule.matchType,
    matchValue: rule.matchValue,
    friendlyName: rule.friendlyName,
    hmrcCategory: rule.hmrcCategory,
    hmrcCategoryLabel: getHmrcCategoryLabel(rule.hmrcCategory),
    privateUsePercent: rule.privateUsePercent,
    bankAccountIds: rule.bankAccountIds,
    priority: rule.priority,
    createdAt: rule.createdAt,
  }
}

export const GET: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const rules = await getRulesForUser(authData.id)
    return Response.json({ rules: rules.map(toRuleDto) })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[categorisation] list rules error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to load categorisation rules',
      500,
    )
  }
}

export const POST: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const body = (await request.json()) as {
      matchValue?: string
      hmrcCategory?: string
      friendlyName?: string | null
      matchType?: RuleMatchType
      priority?: number
      upsert?: boolean
      bankAccountIds?: string[]
      privateUsePercent?: number | null
    }

    if (!body.matchValue?.trim() || !body.hmrcCategory) {
      return jsonError('matchValue and hmrcCategory are required')
    }

    if (!getHmrcCategory(body.hmrcCategory)) {
      return jsonError('Invalid HMRC category')
    }

    const input = {
      matchValue: body.matchValue,
      hmrcCategory: body.hmrcCategory,
      friendlyName: body.friendlyName,
      matchType: body.matchType,
      priority: body.priority,
      bankAccountIds: body.bankAccountIds,
      privateUsePercent: body.privateUsePercent,
    }

    const rule = body.upsert
      ? await upsertRuleForMerchant(authData.id, input)
      : await createCategorisationRule(authData.id, input)

    if (!rule) {
      return jsonError('Failed to create rule', 500)
    }

    return Response.json({ rule: toRuleDto(rule) })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[categorisation] create rule error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to create categorisation rule',
      500,
    )
  }
}

export const PATCH: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const body = (await request.json()) as {
      id?: string
      matchValue?: string
      hmrcCategory?: string
      friendlyName?: string | null
      matchType?: RuleMatchType
      priority?: number
      bankAccountIds?: string[]
      privateUsePercent?: number | null
    }

    if (!body.id) {
      return jsonError('Rule id is required')
    }

    if (body.hmrcCategory && !getHmrcCategory(body.hmrcCategory)) {
      return jsonError('Invalid HMRC category')
    }

    const updated = await updateCategorisationRule(authData.id, body.id, {
      matchValue: body.matchValue,
      hmrcCategory: body.hmrcCategory,
      friendlyName: body.friendlyName,
      matchType: body.matchType,
      priority: body.priority,
      bankAccountIds: body.bankAccountIds,
      privateUsePercent: body.privateUsePercent,
    })

    if (!updated) {
      return jsonError('Rule not found', 404)
    }

    return Response.json({ rule: toRuleDto(updated) })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[categorisation] update rule error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to update categorisation rule',
      500,
    )
  }
}

export const DELETE: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const url = new URL(request.url)
    const ruleId = url.searchParams.get('id')

    if (!ruleId) {
      const result = await clearCategorisationRulesForUser(authData.id)
      return Response.json({ success: true, count: result.count })
    }

    const deleted = await deleteCategorisationRule(authData.id, ruleId)

    if (!deleted) {
      return jsonError('Rule not found', 404)
    }

    return Response.json({ success: true })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[categorisation] delete rule error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to delete categorisation rule',
      500,
    )
  }
}
