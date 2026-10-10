// deno-lint-ignore-file
/* eslint-disable */
// biome-ignore: needed import
import type { OneRouter } from 'one'

declare module 'one' {
  export namespace OneRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes:
        | `/`
        | `/(app)`
        | `/(app)/auth`
        | `/(app)/auth/login`
        | `/(app)/auth/signup/otp`
        | `/(app)/engine`
        | `/(app)/engine/`
        | `/(app)/home`
        | `/(app)/home/`
        | `/(app)/home/(tabs)`
        | `/(app)/home/(tabs)/bank-accounts`
        | `/(app)/home/(tabs)/bank-accounts/`
        | `/(app)/home/(tabs)/categorisation-rules`
        | `/(app)/home/(tabs)/categorisation-rules/`
        | `/(app)/home/(tabs)/categorise-transactions`
        | `/(app)/home/(tabs)/categorise-transactions/`
        | `/(app)/home/(tabs)/download-transactions`
        | `/(app)/home/(tabs)/download-transactions/`
        | `/(app)/home/(tabs)/estimated-tax`
        | `/(app)/home/(tabs)/estimated-tax/`
        | `/(app)/home/(tabs)/estimated-tax/breakdown`
        | `/(app)/home/(tabs)/estimated-tax/summary`
        | `/(app)/home/(tabs)/feed`
        | `/(app)/home/(tabs)/inbox`
        | `/(app)/home/(tabs)/inbox/`
        | `/(app)/home/(tabs)/mileage`
        | `/(app)/home/(tabs)/mileage/`
        | `/(app)/home/(tabs)/records`
        | `/(app)/home/(tabs)/records/`
        | `/(app)/home/(tabs)/settings`
        | `/(app)/home/(tabs)/settings/`
        | `/(app)/home/(tabs)/settings/bank-accounts`
        | `/(app)/home/(tabs)/settings/business-setup`
        | `/(app)/home/(tabs)/settings/edit-profile`
        | `/(app)/home/(tabs)/settings/mtd-email`
        | `/(app)/home/(tabs)/submissions`
        | `/(app)/home/(tabs)/submissions/[quarterId]/`
        | `/(app)/home/(tabs)/submissions/year-end`
        | `/(app)/home/(tabs)/submissions/year-end/`
        | `/(app)/home/(tabs)/submit-to-hmrc`
        | `/(app)/home/(tabs)/submit-to-hmrc/`
        | `/(app)/home/bank-accounts`
        | `/(app)/home/bank-accounts/`
        | `/(app)/home/business-setup`
        | `/(app)/home/business-setup/`
        | `/(app)/home/categorisation-rules`
        | `/(app)/home/categorisation-rules/`
        | `/(app)/home/categorise-transactions`
        | `/(app)/home/categorise-transactions/`
        | `/(app)/home/download-transactions`
        | `/(app)/home/download-transactions/`
        | `/(app)/home/estimated-tax`
        | `/(app)/home/estimated-tax/`
        | `/(app)/home/estimated-tax/breakdown`
        | `/(app)/home/estimated-tax/summary`
        | `/(app)/home/feed`
        | `/(app)/home/inbox`
        | `/(app)/home/inbox/`
        | `/(app)/home/mileage`
        | `/(app)/home/mileage/`
        | `/(app)/home/notification`
        | `/(app)/home/notification/`
        | `/(app)/home/records`
        | `/(app)/home/records/`
        | `/(app)/home/settings`
        | `/(app)/home/settings/`
        | `/(app)/home/settings/bank-accounts`
        | `/(app)/home/settings/business-setup`
        | `/(app)/home/settings/edit-profile`
        | `/(app)/home/settings/mtd-email`
        | `/(app)/home/submissions`
        | `/(app)/home/submissions/[quarterId]/`
        | `/(app)/home/submissions/year-end`
        | `/(app)/home/submissions/year-end/`
        | `/(app)/home/submit-to-hmrc`
        | `/(app)/home/submit-to-hmrc/`
        | `/(legal)/eula`
        | `/(legal)/privacy-policy`
        | `/(legal)/terms-of-service`
        | `/_sitemap`
        | `/auth`
        | `/auth/login`
        | `/auth/signup/otp`
        | `/engine`
        | `/engine/`
        | `/eula`
        | `/help`
        | `/home`
        | `/home/`
        | `/home/(tabs)`
        | `/home/(tabs)/bank-accounts`
        | `/home/(tabs)/bank-accounts/`
        | `/home/(tabs)/categorisation-rules`
        | `/home/(tabs)/categorisation-rules/`
        | `/home/(tabs)/categorise-transactions`
        | `/home/(tabs)/categorise-transactions/`
        | `/home/(tabs)/download-transactions`
        | `/home/(tabs)/download-transactions/`
        | `/home/(tabs)/estimated-tax`
        | `/home/(tabs)/estimated-tax/`
        | `/home/(tabs)/estimated-tax/breakdown`
        | `/home/(tabs)/estimated-tax/summary`
        | `/home/(tabs)/feed`
        | `/home/(tabs)/inbox`
        | `/home/(tabs)/inbox/`
        | `/home/(tabs)/mileage`
        | `/home/(tabs)/mileage/`
        | `/home/(tabs)/records`
        | `/home/(tabs)/records/`
        | `/home/(tabs)/settings`
        | `/home/(tabs)/settings/`
        | `/home/(tabs)/settings/bank-accounts`
        | `/home/(tabs)/settings/business-setup`
        | `/home/(tabs)/settings/edit-profile`
        | `/home/(tabs)/settings/mtd-email`
        | `/home/(tabs)/submissions`
        | `/home/(tabs)/submissions/[quarterId]/`
        | `/home/(tabs)/submissions/year-end`
        | `/home/(tabs)/submissions/year-end/`
        | `/home/(tabs)/submit-to-hmrc`
        | `/home/(tabs)/submit-to-hmrc/`
        | `/home/bank-accounts`
        | `/home/bank-accounts/`
        | `/home/business-setup`
        | `/home/business-setup/`
        | `/home/categorisation-rules`
        | `/home/categorisation-rules/`
        | `/home/categorise-transactions`
        | `/home/categorise-transactions/`
        | `/home/download-transactions`
        | `/home/download-transactions/`
        | `/home/estimated-tax`
        | `/home/estimated-tax/`
        | `/home/estimated-tax/breakdown`
        | `/home/estimated-tax/summary`
        | `/home/feed`
        | `/home/inbox`
        | `/home/inbox/`
        | `/home/mileage`
        | `/home/mileage/`
        | `/home/notification`
        | `/home/notification/`
        | `/home/records`
        | `/home/records/`
        | `/home/settings`
        | `/home/settings/`
        | `/home/settings/bank-accounts`
        | `/home/settings/business-setup`
        | `/home/settings/edit-profile`
        | `/home/settings/mtd-email`
        | `/home/submissions`
        | `/home/submissions/[quarterId]/`
        | `/home/submissions/year-end`
        | `/home/submissions/year-end/`
        | `/home/submit-to-hmrc`
        | `/home/submit-to-hmrc/`
        | `/privacy-policy`
        | `/terms-of-service`
      DynamicRoutes:
        | `/(app)/auth/signup/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/engine/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/engine/${OneRouter.SingleRoutePart<T>}/audiences`
        | `/(app)/engine/${OneRouter.SingleRoutePart<T>}/audit`
        | `/(app)/engine/${OneRouter.SingleRoutePart<T>}/brand`
        | `/(app)/engine/${OneRouter.SingleRoutePart<T>}/experiments`
        | `/(app)/engine/${OneRouter.SingleRoutePart<T>}/experiments/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/engine/${OneRouter.SingleRoutePart<T>}/integrations`
        | `/(app)/engine/${OneRouter.SingleRoutePart<T>}/measurement`
        | `/(app)/engine/${OneRouter.SingleRoutePart<T>}/settings`
        | `/(app)/home/(tabs)/bank-accounts/${OneRouter.SingleRoutePart<T>}/categorise`
        | `/(app)/home/(tabs)/estimated-tax/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/home/(tabs)/settings/bank-accounts/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/home/(tabs)/submissions/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/home/bank-accounts/${OneRouter.SingleRoutePart<T>}/categorise`
        | `/(app)/home/estimated-tax/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/home/settings/bank-accounts/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/home/submissions/${OneRouter.SingleRoutePart<T>}`
        | `/auth/signup/${OneRouter.SingleRoutePart<T>}`
        | `/engine/${OneRouter.SingleRoutePart<T>}`
        | `/engine/${OneRouter.SingleRoutePart<T>}/audiences`
        | `/engine/${OneRouter.SingleRoutePart<T>}/audit`
        | `/engine/${OneRouter.SingleRoutePart<T>}/brand`
        | `/engine/${OneRouter.SingleRoutePart<T>}/experiments`
        | `/engine/${OneRouter.SingleRoutePart<T>}/experiments/${OneRouter.SingleRoutePart<T>}`
        | `/engine/${OneRouter.SingleRoutePart<T>}/integrations`
        | `/engine/${OneRouter.SingleRoutePart<T>}/measurement`
        | `/engine/${OneRouter.SingleRoutePart<T>}/settings`
        | `/home/(tabs)/bank-accounts/${OneRouter.SingleRoutePart<T>}/categorise`
        | `/home/(tabs)/estimated-tax/${OneRouter.SingleRoutePart<T>}`
        | `/home/(tabs)/settings/bank-accounts/${OneRouter.SingleRoutePart<T>}`
        | `/home/(tabs)/submissions/${OneRouter.SingleRoutePart<T>}`
        | `/home/bank-accounts/${OneRouter.SingleRoutePart<T>}/categorise`
        | `/home/estimated-tax/${OneRouter.SingleRoutePart<T>}`
        | `/home/settings/bank-accounts/${OneRouter.SingleRoutePart<T>}`
        | `/home/submissions/${OneRouter.SingleRoutePart<T>}`
      DynamicRouteTemplate:
        | `/(app)/auth/signup/[method]`
        | `/(app)/engine/[workspaceId]`
        | `/(app)/engine/[workspaceId]/audiences`
        | `/(app)/engine/[workspaceId]/audit`
        | `/(app)/engine/[workspaceId]/brand`
        | `/(app)/engine/[workspaceId]/experiments`
        | `/(app)/engine/[workspaceId]/experiments/[experimentId]`
        | `/(app)/engine/[workspaceId]/integrations`
        | `/(app)/engine/[workspaceId]/measurement`
        | `/(app)/engine/[workspaceId]/settings`
        | `/(app)/home/(tabs)/bank-accounts/[accountId]/categorise`
        | `/(app)/home/(tabs)/estimated-tax/[category]`
        | `/(app)/home/(tabs)/settings/bank-accounts/[accountId]`
        | `/(app)/home/(tabs)/submissions/[quarterId]`
        | `/(app)/home/bank-accounts/[accountId]/categorise`
        | `/(app)/home/estimated-tax/[category]`
        | `/(app)/home/settings/bank-accounts/[accountId]`
        | `/(app)/home/submissions/[quarterId]`
        | `/auth/signup/[method]`
        | `/engine/[workspaceId]`
        | `/engine/[workspaceId]/audiences`
        | `/engine/[workspaceId]/audit`
        | `/engine/[workspaceId]/brand`
        | `/engine/[workspaceId]/experiments`
        | `/engine/[workspaceId]/experiments/[experimentId]`
        | `/engine/[workspaceId]/integrations`
        | `/engine/[workspaceId]/measurement`
        | `/engine/[workspaceId]/settings`
        | `/home/(tabs)/bank-accounts/[accountId]/categorise`
        | `/home/(tabs)/estimated-tax/[category]`
        | `/home/(tabs)/settings/bank-accounts/[accountId]`
        | `/home/(tabs)/submissions/[quarterId]`
        | `/home/bank-accounts/[accountId]/categorise`
        | `/home/estimated-tax/[category]`
        | `/home/settings/bank-accounts/[accountId]`
        | `/home/submissions/[quarterId]`
      IsTyped: true
      RouteTypes: {
        '/(app)/auth/signup/[method]': RouteInfo<{ method: string }>
        '/(app)/engine/[workspaceId]': RouteInfo<{ workspaceId: string }>
        '/(app)/engine/[workspaceId]/audiences': RouteInfo<{ workspaceId: string }>
        '/(app)/engine/[workspaceId]/audit': RouteInfo<{ workspaceId: string }>
        '/(app)/engine/[workspaceId]/brand': RouteInfo<{ workspaceId: string }>
        '/(app)/engine/[workspaceId]/experiments': RouteInfo<{ workspaceId: string }>
        '/(app)/engine/[workspaceId]/experiments/[experimentId]': RouteInfo<{ workspaceId: string; experimentId: string }>
        '/(app)/engine/[workspaceId]/integrations': RouteInfo<{ workspaceId: string }>
        '/(app)/engine/[workspaceId]/measurement': RouteInfo<{ workspaceId: string }>
        '/(app)/engine/[workspaceId]/settings': RouteInfo<{ workspaceId: string }>
        '/(app)/home/(tabs)/bank-accounts/[accountId]/categorise': RouteInfo<{ accountId: string }>
        '/(app)/home/(tabs)/estimated-tax/[category]': RouteInfo<{ category: string }>
        '/(app)/home/(tabs)/settings/bank-accounts/[accountId]': RouteInfo<{ accountId: string }>
        '/(app)/home/(tabs)/submissions/[quarterId]': RouteInfo<{ quarterId: string }>
        '/(app)/home/bank-accounts/[accountId]/categorise': RouteInfo<{ accountId: string }>
        '/(app)/home/estimated-tax/[category]': RouteInfo<{ category: string }>
        '/(app)/home/settings/bank-accounts/[accountId]': RouteInfo<{ accountId: string }>
        '/(app)/home/submissions/[quarterId]': RouteInfo<{ quarterId: string }>
        '/auth/signup/[method]': RouteInfo<{ method: string }>
        '/engine/[workspaceId]': RouteInfo<{ workspaceId: string }>
        '/engine/[workspaceId]/audiences': RouteInfo<{ workspaceId: string }>
        '/engine/[workspaceId]/audit': RouteInfo<{ workspaceId: string }>
        '/engine/[workspaceId]/brand': RouteInfo<{ workspaceId: string }>
        '/engine/[workspaceId]/experiments': RouteInfo<{ workspaceId: string }>
        '/engine/[workspaceId]/experiments/[experimentId]': RouteInfo<{ workspaceId: string; experimentId: string }>
        '/engine/[workspaceId]/integrations': RouteInfo<{ workspaceId: string }>
        '/engine/[workspaceId]/measurement': RouteInfo<{ workspaceId: string }>
        '/engine/[workspaceId]/settings': RouteInfo<{ workspaceId: string }>
        '/home/(tabs)/bank-accounts/[accountId]/categorise': RouteInfo<{ accountId: string }>
        '/home/(tabs)/estimated-tax/[category]': RouteInfo<{ category: string }>
        '/home/(tabs)/settings/bank-accounts/[accountId]': RouteInfo<{ accountId: string }>
        '/home/(tabs)/submissions/[quarterId]': RouteInfo<{ quarterId: string }>
        '/home/bank-accounts/[accountId]/categorise': RouteInfo<{ accountId: string }>
        '/home/estimated-tax/[category]': RouteInfo<{ category: string }>
        '/home/settings/bank-accounts/[accountId]': RouteInfo<{ accountId: string }>
        '/home/submissions/[quarterId]': RouteInfo<{ quarterId: string }>
      }
    }
  }
}

/**
 * Helper type for route information
 */
type RouteInfo<Params = Record<string, never>> = {
  Params: Params
  LoaderProps: { path: string; search?: string; subdomain?: string; params: Params; request?: Request }
}