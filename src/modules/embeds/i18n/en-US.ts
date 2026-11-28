export const embedsEnUS = {
  command: { name: 'embeds', description: 'Fix broken link previews with embeds.now' },
  toggle: { name: 'toggle', description: 'Turn link fixing on or off for this server' },
  status: { name: 'status', description: 'Show the current link-fixing configuration' },
  options: {
    enabled: { name: 'enabled', description: 'Whether to fix links' },
  },
  sites: {
    twitter: 'X / Twitter',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    reddit: 'Reddit',
    spotify: 'Spotify',
    threads: 'Threads',
    bluesky: 'Bluesky',
    pinterest: 'Pinterest',
    facebook: 'Facebook',
  },
  deleteReason: 'Reposted with a fixed link preview (embeds.now)',
  replies: {
    enabled:
      'Link fixing is on. It works in channels where I have Manage Messages and Manage Webhooks, so to leave a channel out, deny me one of those there.',
    disabled: 'Link fixing is off.',
    statusTitle: 'Link fixing',
    statusState: 'Status',
    statusOn: 'On',
    statusOff: 'Off',
    statusSites: 'Sites',
  },
} as const;
