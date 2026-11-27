export const countingEnUS = {
  command: { name: 'counting', description: 'Set up a counting channel' },
  channel: { name: 'channel', description: 'Set the counting channel (empty disables)' },
  options: { channel: { name: 'channel', description: 'Counting channel' } },
  broken: '{user} broke the count at **{count}**! Start again from 1. Record: **{record}**.',
  twice: "{user}, you can't count twice in a row! Start again from 1. Record: **{record}**.",
  replies: {
    set: 'Counting in {channel}. Start from 1!',
    disabled: 'Counting disabled.',
    intentDisabled:
      'Note: the bot is running without the Message Content intent, so it cannot read numbers until the bot owner enables it.',
  },
} as const;
