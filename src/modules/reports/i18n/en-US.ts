export const reportsEnUS = {
  menus: { message: 'Report message', user: 'Report user' },
  command: { name: 'reports', description: 'Configure reports' },
  channel: { name: 'channel', description: 'Set the channel where reports go' },
  options: {
    channel: { name: 'channel', description: 'Reports channel' },
  },
  modal: {
    title: 'Report to the moderators',
    reason: 'What is wrong?',
    placeholder: 'Describe the problem',
  },
  embed: {
    title: 'Report #{id}',
    reporter: 'Reported by',
    target: 'Reported user',
    message: 'Message',
    reason: 'Reason',
    status: 'Status',
    handledBy: '{status} by {moderator}',
    jump: 'Jump to message',
    noContent: '(no text)',
  },
  status: { open: 'Open', resolved: 'Resolved', dismissed: 'Dismissed' },
  buttons: { resolve: 'Resolve', dismiss: 'Dismiss' },
  replies: {
    sent: 'Thanks. The moderators were notified.',
    notConfigured: 'Reports are not set up on this server.',
    self: "You can't report yourself.",
    channelSet: 'Reports will be sent to {channel}.',
    notAllowed: 'You need the Manage Messages permission to handle reports.',
    messageGone: 'That message no longer exists.',
  },
} as const;
