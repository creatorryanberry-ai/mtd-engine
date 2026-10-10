import { defineRelations } from 'drizzle-orm'
import * as schema from './schema'

export const relations = defineRelations(schema, (r) => ({
  user: {
    accounts: r.many.account({
      from: r.user.id,
      to: r.account.userId,
    }),
    sessions: r.many.session({
      from: r.user.id,
      to: r.session.userId,
    }),
    bankLinkItem: r.one.bankLinkItem({
      from: r.user.id,
      to: r.bankLinkItem.userId,
    }),
  },

  account: {
    user: r.one.user({
      from: r.account.userId,
      to: r.user.id,
    }),
  },

  session: {
    user: r.one.user({
      from: r.session.userId,
      to: r.user.id,
    }),
  },

  bankLinkItem: {
    user: r.one.user({
      from: r.bankLinkItem.userId,
      to: r.user.id,
    }),
  },

  userPublic: {
    state: r.one.userState({
      from: r.userPublic.id,
      to: r.userState.userId,
    }),
    mtdTransactions: r.many.mtdTransaction({
      from: r.userPublic.id,
      to: r.mtdTransaction.userId,
    }),
    mtdSubmissions: r.many.mtdSubmission({
      from: r.userPublic.id,
      to: r.mtdSubmission.userId,
    }),
    categorisationRules: r.many.categorisationRule({
      from: r.userPublic.id,
      to: r.categorisationRule.userId,
    }),
    notifications: r.many.notification({
      from: r.userPublic.id,
      to: r.notification.userId,
    }),
    devices: r.many.device({
      from: r.userPublic.id,
      to: r.device.userId,
    }),
    merchantFingerprints: r.many.merchantFingerprint({
      from: r.userPublic.id,
      to: r.merchantFingerprint.userId,
    }),
    mileageEntries: r.many.mileageEntry({
      from: r.userPublic.id,
      to: r.mileageEntry.userId,
    }),
    mileageSeries: r.many.mileageSeries({
      from: r.userPublic.id,
      to: r.mileageSeries.userId,
    }),
  },

  userState: {
    user: r.one.userPublic({
      from: r.userState.userId,
      to: r.userPublic.id,
    }),
  },

  businessSettings: {
    user: r.one.user({
      from: r.businessSettings.userId,
      to: r.user.id,
    }),
  },

  mtdTransaction: {
    user: r.one.userPublic({
      from: r.mtdTransaction.userId,
      to: r.userPublic.id,
    }),
  },

  mtdSubmission: {
    user: r.one.userPublic({
      from: r.mtdSubmission.userId,
      to: r.userPublic.id,
    }),
  },

  categorisationRule: {
    user: r.one.userPublic({
      from: r.categorisationRule.userId,
      to: r.userPublic.id,
    }),
    bankAccounts: r.many.categorisationRuleBankAccount({
      from: r.categorisationRule.id,
      to: r.categorisationRuleBankAccount.ruleId,
    }),
  },

  categorisationRuleBankAccount: {
    rule: r.one.categorisationRule({
      from: r.categorisationRuleBankAccount.ruleId,
      to: r.categorisationRule.id,
    }),
  },

  notification: {
    user: r.one.userPublic({
      from: r.notification.userId,
      to: r.userPublic.id,
    }),
    actor: r.one.userPublic({
      from: r.notification.actorId,
      to: r.userPublic.id,
    }),
  },

  device: {
    user: r.one.userPublic({
      from: r.device.userId,
      to: r.userPublic.id,
    }),
  },

  merchantFingerprint: {
    user: r.one.userPublic({
      from: r.merchantFingerprint.userId,
      to: r.userPublic.id,
    }),
  },

  taxEstimateProfile: {
    user: r.one.userPublic({
      from: r.taxEstimateProfile.userId,
      to: r.userPublic.id,
    }),
  },

  mileageSeries: {
    user: r.one.userPublic({
      from: r.mileageSeries.userId,
      to: r.userPublic.id,
    }),
    entries: r.many.mileageEntry({
      from: r.mileageSeries.id,
      to: r.mileageEntry.seriesId,
    }),
  },

  mileageEntry: {
    user: r.one.userPublic({
      from: r.mileageEntry.userId,
      to: r.userPublic.id,
    }),
    series: r.one.mileageSeries({
      from: r.mileageEntry.seriesId,
      to: r.mileageSeries.id,
    }),
  },
}))
