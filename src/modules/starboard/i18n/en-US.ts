export const starboardEnUS = {
  command: { name: 'starboard', description: 'Configure the starboard' },
  channel: { name: 'channel', description: 'Set the starboard channel and threshold' },
  disable: { name: 'disable', description: 'Turn the starboard off' },
  options: {
    channel: { name: 'channel', description: 'Starboard channel' },
    threshold: { name: 'threshold', description: 'Stars needed (default 3)' },
  },
  post: {
    header: '⭐ **{count}** · {channel}',
    jump: 'Jump to message',
  },
  replies: {
    set: 'Messages with {threshold} ⭐ will be posted in {channel}.',
    disabled: 'Starboard disabled.',
  },
} as const;
