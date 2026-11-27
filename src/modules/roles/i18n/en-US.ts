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
  reaction: {
    command: { name: 'reactionroles', description: 'Give roles when members react to a message' },
    setup: { name: 'setup', description: 'Link emojis to roles on an existing message' },
    remove: { name: 'remove', description: 'Unlink one emoji, or every emoji, from a message' },
    list: { name: 'list', description: 'List reaction-role messages' },
    options: {
      message: { name: 'message', description: 'Message ID or link' },
      pairs: {
        name: 'roles',
        description: 'Emoji and role pairs, e.g. 🎮 @Gamer 🎨 @Artist (role IDs work too)',
      },
      channel: {
        name: 'channel',
        description: "Channel of the message (default: here, or the link's)",
      },
      emoji: { name: 'emoji', description: 'Only this emoji (default: all)' },
    },
    replies: {
      done: 'Linked {count} role(s) on {url}',
      pair: '{emoji} → {role}',
      invalid: 'Skipped, not an emoji followed by a role: {items}',
      duplicate: 'Skipped {emoji}: it appears twice.',
      tooMany: 'Skipped: a message can have at most {max} reactions.',
      reactFailed:
        "Skipped {emoji}: I can't react with it (custom emojis must be from a server I'm in).",
      messageNotFound:
        "I couldn't find that message. Use its ID with the right channel, or paste its link.",
      reactPermission: 'I need Add Reactions and Read Message History in {channel}.',
      removed: 'Removed {count} reaction role(s).',
      none: 'No reaction roles yet. Set them up with /reactionroles setup.',
      listTitle: 'Reaction roles',
    },
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
