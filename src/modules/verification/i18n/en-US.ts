export const verificationEnUS = {
  command: { name: 'verification', description: 'Set up the verification gate' },
  setup: { name: 'setup', description: 'Post the verify button and choose the role it gives' },
  options: {
    channel: { name: 'channel', description: 'Where to post the button' },
    role: { name: 'role', description: 'Role given to verified members' },
    minAge: { name: 'min_account_age', description: 'Minimum account age in days (default 0)' },
  },
  panel: {
    title: 'Verification',
    description: 'Press the button below to confirm you are human and get access to the server.',
    button: 'Verify',
  },
  replies: {
    posted: 'Verification button posted in {channel}. It gives {role}.',
    verified: 'You are verified. Welcome!',
    already: 'You are already verified.',
    tooNew: 'Your account is too new to verify here. Try again {when}.',
    notConfigured: 'Verification is not set up on this server.',
    unassignable:
      "I can't assign {role}: it is managed by an integration or is not below my highest role.",
    postFailed: "I couldn't post in {channel}. Check my permissions there.",
  },
} as const;
