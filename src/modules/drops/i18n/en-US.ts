export const dropsEnUS = {
  command: { name: 'drops', description: 'Airdrops in busy channels' },
  setup: { name: 'setup', description: 'Start an airdrop every N messages in a channel' },
  disable: { name: 'disable', description: 'Stop drops in a channel' },
  list: { name: 'list', description: 'Channels with drops' },
  top: { name: 'top', description: 'Members who won the most airdrops' },
  options: {
    channel: { name: 'channel', description: 'The channel' },
    every: {
      name: 'every',
      description: 'Counted messages between airdrops (one per member every 5 s)',
    },
    xp: { name: 'xp', description: 'XP each winner gets' },
    lifetime: {
      name: 'lifetime',
      description: 'Seconds members have to react before the draw (default 60)',
    },
    winners: { name: 'winners', description: 'How many reactors win (default 1)' },
  },
  drop: {
    title: '🎁 Airdrop!',
    description:
      'React with {emoji} to enter. {winners} random winner(s) get **{xp} XP** each. Drawing {when}.',
    ended: 'Airdrop over. Winners: {winners} (+{xp} XP each, out of {entrants} entries).',
    noEntries: 'Airdrop over. Nobody reacted in time.',
    announce: '🎉 {winners} won the airdrop: **{xp} XP**!',
  },
  replies: {
    configured:
      'An airdrop for {winners} winner(s) worth {xp} XP will appear every {every} messages in {channel}.',
    disabled: 'Drops disabled in {channel}.',
    notConfigured: 'Drops are not enabled in {channel}.',
    none: 'No channels have drops yet.',
    listTitle: 'Drop channels',
    line: '{channel} · every {every} messages · {xp} XP · {progress}/{every} counted so far',
    topTitle: 'Top airdrop winners',
    topLine: '**{position}.** {user} · {claims} wins · {xp} XP',
    noClaims: 'Nobody has won an airdrop yet.',
  },
} as const;
