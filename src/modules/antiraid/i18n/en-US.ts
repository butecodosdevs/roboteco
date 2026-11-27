export const antiraidEnUS = {
  command: { name: 'antiraid', description: 'Protect the server from mass joins' },
  config: { name: 'config', description: 'Lock down when too many members join too fast' },
  lockdown: { name: 'lockdown', description: 'Lock the server down now' },
  unlock: { name: 'unlock', description: 'End the lockdown' },
  options: {
    joins: { name: 'joins', description: 'Joins that trigger a lockdown (0 disables)' },
    seconds: { name: 'seconds', description: 'Within this many seconds (default 10)' },
  },
  alert: {
    title: 'Raid lockdown',
    automatic:
      '{count} members joined in {seconds}s. Invites are paused and verification is set to High.',
    manual: 'Lockdown started by {user}. Invites are paused and verification is set to High.',
    unlocked: 'Lockdown lifted by {user}. Invites and verification level are restored.',
  },
  replies: {
    configured: 'Lockdown triggers at {joins} joins within {seconds}s.',
    disabled: 'Automatic lockdown disabled.',
    locked: 'Server locked down. Run /antiraid unlock when it is over.',
    alreadyLocked: 'The server is already locked down.',
    unlocked: 'Lockdown lifted.',
    notLocked: 'The server is not locked down.',
    botPermission: 'I need the Manage Server permission for lockdowns.',
    intentDisabled:
      'Note: the bot is running without the Server Members intent, so it will not see joins until the bot owner enables it.',
  },
} as const;
