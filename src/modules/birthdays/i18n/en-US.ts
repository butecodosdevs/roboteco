export const birthdaysEnUS = {
  command: { name: 'birthday', description: 'Birthdays' },
  set: { name: 'set', description: 'Save your birthday' },
  remove: { name: 'remove', description: 'Forget your birthday' },
  upcoming: { name: 'upcoming', description: 'Upcoming birthdays in this server' },
  setup: { name: 'setup', description: 'Choose where birthdays are announced (staff)' },
  options: {
    month: { name: 'month', description: 'Month (1-12)' },
    day: { name: 'day', description: 'Day (1-31)' },
    channel: { name: 'channel', description: 'Announcement channel (empty disables)' },
    role: { name: 'role', description: 'Role given for the day (optional)' },
  },
  announce: '🎂 Happy birthday {users}!',
  replies: {
    saved: 'Saved: {day}/{month}.',
    invalidDate: 'That date does not exist.',
    removed: 'Your birthday was removed.',
    none: 'No birthdays saved yet.',
    upcomingTitle: 'Upcoming birthdays',
    line: '{date} · {user}',
    configured: 'Birthdays will be announced in {channel}.',
    disabled: 'Birthday announcements disabled.',
    notAllowed: 'You need the Manage Server permission to do that.',
    unassignable:
      "I can't assign {role}: it is managed by an integration or is not below my highest role.",
  },
} as const;
