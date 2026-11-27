export const ticketsEnUS = {
  command: { name: 'tickets', description: 'Configure support tickets' },
  panel: { name: 'panel', description: 'Post the "open a ticket" button in a channel' },
  staff: { name: 'staff', description: 'Set the role that handles tickets' },
  options: {
    channel: { name: 'channel', description: 'Where to post the button' },
    role: { name: 'role', description: 'Staff role' },
  },
  panelMessage: {
    title: 'Need help?',
    description: 'Press the button to open a private ticket with the staff.',
    open: 'Open a ticket',
  },
  thread: {
    name: 'ticket-{user}',
    welcome: 'Hi {user}! Describe your problem and {staff} will help you soon.',
    staffFallback: 'the staff',
    close: 'Close ticket',
    closed: 'Ticket closed by {user}.',
  },
  replies: {
    panelPosted: 'Ticket button posted in {channel}.',
    staffSet: 'Tickets will notify {role}.',
    alreadyOpen: 'You already have an open ticket: {thread}.',
    opened: 'Your ticket is open: {thread}.',
    unsupported: 'Tickets need a regular text channel.',
    botPermission: 'I need the Create Private Threads and Manage Threads permissions here.',
    notAllowed: 'Only the ticket owner or staff can close this ticket.',
    postFailed: "I couldn't post in {channel}. Check my permissions there.",
  },
} as const;
