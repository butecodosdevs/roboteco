export const privacyEnUS = {
  command: { name: 'privacy', description: 'See or delete the data the bot keeps about you' },
  info: { name: 'info', description: 'What data the bot keeps' },
  delete: { name: 'delete', description: 'Delete your data from the bot' },
  forget: { name: 'forget', description: "Delete a member's data in this server (staff)" },
  options: {
    user: { name: 'user', description: 'Whose data to delete' },
  },
  infoText: [
    '**What roboteco stores about members**',
    '• Levels: your XP in each server.',
    '• Tags and suggestions you created, and your suggestion votes.',
    '• Reminders you set.',
    '• Tickets you opened and reports you filed.',
    '• Moderation cases about you. These are server records and are kept.',
    '',
    "Server logs and moderation logs are Discord messages in the server, so the bot can't delete them.",
    "When the bot leaves a server, that server's data is deleted after {days} days.",
    'Use /privacy delete to delete your data.',
  ].join('\n'),
  confirmSelf:
    'This deletes your levels, tags, suggestions and votes, reminders, tickets and filed reports in **every** server. Moderation cases are kept. Continue?',
  confirmForget:
    "This deletes {user}'s levels, tags, suggestions and votes, reminders, tickets and filed reports in this server. Moderation cases are kept. Continue?",
  buttons: { confirm: 'Delete', cancel: 'Cancel' },
  replies: {
    deleted: 'Done. The data was deleted.',
    cancelled: 'Nothing was deleted.',
    notYours: 'Only the person who ran the command can confirm.',
    notAllowed: 'You need the Manage Server permission to do that.',
  },
} as const;
