export const pluginsEnUS = {
  command: { name: 'plugin', description: 'Community plugins' },
  list: { name: 'list', description: 'List installed plugins' },
  replies: {
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
