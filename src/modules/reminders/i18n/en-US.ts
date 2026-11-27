export const remindersEnUS = {
  remind: { name: 'remind', description: 'Set a reminder' },
  command: { name: 'reminders', description: 'Manage your reminders' },
  list: { name: 'list', description: 'List your reminders' },
  cancel: { name: 'cancel', description: 'Cancel a reminder' },
  options: {
    when: { name: 'in', description: 'When, e.g. 10m, 2h30m, 3d' },
    text: { name: 'text', description: 'What to remind you of' },
    id: { name: 'id', description: 'Reminder number' },
  },
  delivery: '⏰ {user}, reminder: {text}',
  replies: {
    set: 'Reminder #{id} set for {when}.',
    invalidTime:
      "I couldn't understand that time. Use something like 10m, 2h30m or 3d (1 minute to 1 year).",
    tooMany: 'You can have at most {max} reminders.',
    none: 'You have no reminders.',
    listTitle: 'Your reminders',
    line: '**#{id}** · {when} · {text}',
    cancelled: 'Reminder #{id} cancelled.',
    notFound: 'Reminder #{id} does not exist.',
  },
} as const;
