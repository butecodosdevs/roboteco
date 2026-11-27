export const welcomeEnUS = {
  command: { name: 'welcome', description: 'Configure welcome messages and the join role' },
  channel: { name: 'channel', description: 'Set the welcome channel (empty disables messages)' },
  message: { name: 'message', description: 'Set the welcome text (empty restores the default)' },
  role: { name: 'role', description: 'Give a role to new members (empty disables it)' },
  test: { name: 'test', description: 'Preview the welcome message' },
  options: {
    channel: { name: 'channel', description: 'Welcome channel' },
    text: { name: 'text', description: 'Use {user}, {server} and {count}' },
    role: { name: 'role', description: 'Role for new members' },
  },
  defaultMessage: 'Welcome to **{server}**, {user}! You are member #{count}.',
  replies: {
    channelSet: 'Welcome messages will be posted in {channel}.',
    channelCleared: 'Welcome messages disabled.',
    messageSet: 'Welcome message updated.',
    messageReset: 'Welcome message reset to the default.',
    roleSet: 'New members will get {role}.',
    roleCleared: 'New members will not get a role.',
    unassignable:
      "I can't assign {role}: it is managed by an integration or is not below my highest role.",
    notConfigured: 'Set a welcome channel first with /welcome channel.',
    testSent: 'Preview posted in {channel}.',
    intentDisabled:
      'Note: the bot is running without the Server Members intent, so it will not see new members until the bot owner enables it.',
  },
} as const;
