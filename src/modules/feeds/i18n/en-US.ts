export const feedsEnUS = {
  command: { name: 'feeds', description: 'Post new items from RSS, Atom or YouTube feeds' },
  add: { name: 'add', description: 'Follow a feed' },
  remove: { name: 'remove', description: 'Stop following a feed' },
  list: { name: 'list', description: 'List followed feeds' },
  options: {
    url: { name: 'url', description: 'Feed URL (RSS/Atom, or a YouTube channel feed)' },
    channel: { name: 'channel', description: 'Where to post new items' },
    id: { name: 'id', description: 'Feed number' },
  },
  post: '**{feed}**: {title}\n{link}',
  replies: {
    added: 'Following **{title}** in {channel}. New items are checked every 10 minutes.',
    invalid: "That URL doesn't point to a readable public RSS or Atom feed.",
    tooMany: 'A server can follow at most {max} feeds.',
    removed: 'Feed #{id} removed.',
    notFound: 'Feed #{id} does not exist.',
    none: 'No feeds yet. Add one with /feeds add.',
    listTitle: 'Followed feeds',
    line: '**#{id}** · {title} · {channel}',
  },
} as const;
