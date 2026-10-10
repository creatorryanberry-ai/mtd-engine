export const queryKeys = {
  handshake: ['handshake'] as const,
  userMe: (userId: string) => ['users', 'me', userId] as const,
  businessSettings: (userId: string) => ['users', 'business-settings', userId] as const,
  transactions: (userId: string) => ['transactions', userId] as const,
  notifications: (userId: string) => ['notifications', userId] as const,
  unreadNotificationCount: (userId: string) =>
    ['notifications', userId, 'unread-count'] as const,
  inbox: (userId: string) => ['inbox', userId] as const,
  inboundEmailAddress: (userId: string) => ['inbox', 'address', userId] as const,
  submissionJobs: (userId: string) => ['submissions', 'jobs', userId] as const,
  taxEstimate: (userId: string, taxYearStart: string) =>
    ['tax-estimate', userId, taxYearStart] as const,
}
