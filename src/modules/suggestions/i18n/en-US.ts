export const suggestionsEnUS = {
  suggest: { name: 'suggest', description: 'Suggest something for the server' },
  command: { name: 'suggestions', description: 'Manage suggestions' },
  channel: { name: 'channel', description: 'Set the channel where suggestions are posted' },
  approve: { name: 'approve', description: 'Approve a suggestion' },
  deny: { name: 'deny', description: 'Deny a suggestion' },
  options: {
    content: { name: 'suggestion', description: 'Your suggestion' },
    channel: { name: 'channel', description: 'Suggestions channel' },
    id: { name: 'id', description: 'Suggestion number' },
    reason: { name: 'reason', description: 'Why (shown on the suggestion)' },
  },
  status: { pending: 'Open', approved: 'Approved', denied: 'Denied' },
  embed: {
    footer: 'Suggestion #{id} · {status}',
    decision: 'Decision by {moderator}',
    noReason: 'No reason given',
  },
  replies: {
    posted: 'Your suggestion was posted in {channel}.',
    notConfigured: 'Suggestions are not set up yet. Ask a moderator to run /suggestions channel.',
    channelSet: 'Suggestions will be posted in {channel}.',
    notFound: 'Suggestion #{id} does not exist.',
    decided: 'Suggestion #{id} marked as {status}.',
    postFailed: "I couldn't post in {channel}. Check my permissions there.",
  },
} as const;
