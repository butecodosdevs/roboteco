export const honeypotEnUS = {
  command: { name: 'honeypot', description: 'Ban anyone who posts in a trap channel' },
  set: { name: 'set', description: 'Set the honeypot channel' },
  disable: { name: 'disable', description: 'Disable the honeypot' },
  status: { name: 'status', description: 'Show the honeypot configuration' },
  options: {
    channel: { name: 'channel', description: 'Anyone who posts here gets banned' },
    deleteMessages: {
      name: 'delete_messages',
      description: "How much of the banned user's recent messages to delete",
    },
  },
  windows: {
    none: 'None',
    hour: 'Last hour',
    day: 'Last 24 hours',
    week: 'Last 7 days',
  },
  replies: {
    set: 'Honeypot set to {channel}. Anyone who posts there will be banned.',
    warningFailed: "I couldn't post the warning in {channel}. Check my permissions there.",
    disabled: 'Honeypot disabled.',
    notConfigured: 'No honeypot channel is configured.',
    status: 'Honeypot: {channel}. Messages deleted on ban: {window}.',
    missingBanPermission: 'I need the Ban Members permission to run a honeypot.',
  },
  warning:
    '**Do not post in this channel.** It is a trap for spam bots: anyone who sends a message here is banned automatically.',
  banReason: 'Honeypot: posted in #{channel}',
} as const;
