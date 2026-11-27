export const scheduledPostsEnUS = {
  command: { name: 'schedule', description: 'Schedule messages to be posted later' },
  post: { name: 'post', description: 'Schedule a message' },
  list: { name: 'list', description: 'List scheduled messages' },
  cancel: { name: 'cancel', description: 'Cancel a scheduled message' },
  options: {
    channel: { name: 'channel', description: 'Where to post' },
    in: { name: 'in', description: 'When the first post goes out, e.g. 30m, 2h, 1d' },
    message: { name: 'message', description: 'What to post' },
    repeat: { name: 'repeat', description: 'Repeat it (default no)' },
    id: { name: 'id', description: 'Scheduled message number' },
  },
  repeats: { none: 'No', daily: 'Every day', weekly: 'Every week' },
  replies: {
    scheduled: 'Message #{id} will be posted in {channel} {when}.',
    invalidTime: 'Use a time like 30m, 2h or 1d (1 minute to 1 year).',
    none: 'Nothing is scheduled.',
    listTitle: 'Scheduled messages',
    line: '**#{id}** · {channel} · {when} · {repeat} · {preview}',
    cancelled: 'Scheduled message #{id} cancelled.',
    notFound: 'Scheduled message #{id} does not exist.',
    tooMany: 'A server can have at most {max} scheduled messages.',
  },
} as const;
