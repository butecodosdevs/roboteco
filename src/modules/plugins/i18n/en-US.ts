export const pluginsEnUS = {
  command: { name: 'plugin', description: 'Community plugins' },
  list: { name: 'list', description: 'List installed plugins' },
  replies: {
    forbidden: 'You need {permissions} to use this.',
    lateModal: 'The plugin **{plugin}** tried to open a form too late. Try again.',
    expired: 'This control belongs to a plugin that is no longer installed.',
    guildOnly: 'This command only works inside a server.',
    timeout: 'The plugin **{plugin}** took too long and was stopped.',
    crash: 'The plugin **{plugin}** failed.',
    invalid: 'The plugin **{plugin}** sent a response I could not use.',
    empty: 'The plugin **{plugin}** had nothing to say.',
    none: 'No plugins are installed.',
    listTitle: 'Plugins',
    line: '**{plugin}** {version} · {commands} · permissions: {permissions}',
    noPermissions: 'none',
  },
} as const;
