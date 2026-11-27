export const invitesEnUS = {
  command: { name: 'invites', description: 'Invite tracking' },
  count: { name: 'count', description: 'How many members someone invited' },
  top: { name: 'top', description: 'Top inviters' },
  options: { user: { name: 'user', description: 'Whose invites to count (default you)' } },
  replies: {
    count: '{user} invited **{active}** member(s) who are still here ({total} in total).',
    none: 'No tracked invites yet.',
    topTitle: 'Top inviters',
    line: '**{position}.** {user} · {active} ({total} total)',
    intentDisabled:
      'Note: the bot is running without the Server Members intent, so joins are not being tracked until the bot owner enables it.',
  },
} as const;
