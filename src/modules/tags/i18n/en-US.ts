export const tagsEnUS = {
  command: { name: 'tag', description: 'Save and recall text snippets' },
  add: { name: 'add', description: 'Save a tag' },
  show: { name: 'show', description: 'Post a saved tag' },
  list: { name: 'list', description: 'List all tags' },
  delete: { name: 'delete', description: 'Delete a tag' },
  options: {
    name: { name: 'name', description: 'Tag name' },
    content: { name: 'content', description: 'Text to save' },
  },
  replies: {
    saved: 'Saved tag **{name}**.',
    exists: 'A tag named **{name}** already exists.',
    notFound: 'No tag named **{name}**.',
    deleted: 'Deleted tag **{name}**.',
    notAllowed: 'Only the author or members with Manage Messages can delete **{name}**.',
    empty: 'No tags yet. Create one with /tag add.',
    listTitle: 'Tags ({count})',
  },
} as const;
