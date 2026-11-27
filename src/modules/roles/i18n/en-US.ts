export const rolesEnUS = {
  command: { name: 'roles', description: 'Manage self-assignable roles' },
  add: { name: 'add', description: 'Make a role self-assignable' },
  remove: { name: 'remove', description: 'Stop a role from being self-assignable' },
  panel: { name: 'panel', description: 'Post the role picker in a channel' },
  options: {
    role: { name: 'role', description: 'The role' },
    description: { name: 'description', description: 'Shown under the role in the picker' },
    channel: { name: 'channel', description: 'Where to post the picker' },
  },
  picker: {
    title: 'Pick your roles',
    description: 'Choose the roles you want from the menu below. Unselect a role to remove it.',
    placeholder: 'Select roles',
  },
  replies: {
    added: 'Members can now pick {role}.',
    removed: '{role} is no longer self-assignable.',
    notListed: '{role} is not self-assignable.',
    tooMany: 'The picker holds at most 25 roles.',
    unassignable:
      "I can't assign {role}: it is managed by an integration or is not below my highest role.",
    panelPosted: 'Role picker posted in {channel}.',
    postFailed: "I couldn't post in {channel}. Check my permissions there.",
    noRoles: 'There are no self-assignable roles yet. Add some with /roles add.',
    botPermission: 'I need the Manage Roles permission for that.',
    changes: 'Added: {added}\nRemoved: {removed}',
    nothing: 'Nothing changed.',
    none: 'none',
  },
} as const;
