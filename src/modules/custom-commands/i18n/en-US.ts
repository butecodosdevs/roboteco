export const customCommandsEnUS = {
  command: { name: 'customcommand', description: 'Create slash commands that reply with text' },
  add: { name: 'add', description: 'Create or update a custom command' },
  remove: { name: 'remove', description: 'Delete a custom command' },
  list: { name: 'list', description: 'List custom commands' },
  options: {
    name: { name: 'name', description: 'Command name: lowercase letters, numbers, - and _' },
    response: { name: 'response', description: 'What the command replies' },
    description: { name: 'description', description: 'Shown in the command menu' },
  },
  defaultDescription: 'Custom command',
  replies: {
    saved: 'Saved /{name}. It may take a moment to appear in the menu.',
    invalidName: 'Names use 1-32 lowercase letters, numbers, - or _.',
    reserved: '/{name} is already a built-in command.',
    tooMany: 'A server can have at most {max} custom commands.',
    removed: 'Deleted /{name}.',
    notFound: 'There is no custom command /{name}.',
    none: 'No custom commands yet.',
    listTitle: 'Custom commands',
  },
} as const;
