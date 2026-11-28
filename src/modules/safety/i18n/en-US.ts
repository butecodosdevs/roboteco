export const safetyEnUS = {
  command: {
    name: 'safety',
    description: 'Remove links and files that security checks confirm are malicious',
  },
  toggle: { name: 'toggle', description: 'Turn scanning on or off for this server' },
  timeout: {
    name: 'timeout',
    description: 'Time out members whose message was removed (0 turns it off)',
  },
  status: {
    name: 'status',
    description: 'Show the scanning settings and which checks are running',
  },
  options: {
    enabled: { name: 'enabled', description: 'Whether to scan messages' },
    minutes: { name: 'minutes', description: 'Timeout length in minutes, 0 for none' },
  },
  sources: {
    phishingList: 'Phishing domain list',
    safeBrowsing: 'Google Safe Browsing',
    urlhaus: 'URLhaus',
    malwareBazaar: 'MalwareBazaar',
    virusTotal: 'VirusTotal',
    clamav: 'ClamAV',
  },
  deleteReason: 'Malicious content confirmed by {sources}',
  log: {
    title: 'Malicious content found',
    author: '**Author:** {user} ({id})',
    channel: '**Channel:** {channel}',
    finding: '`{target}`: {source} ({detail})',
    recheck: 'Found when the message was checked again after posting.',
    notDeleted: '⚠️ I could not delete the message. Give me Manage Messages in that channel.',
    timedOut: 'The author was timed out for {minutes} minutes.',
  },
  dm: 'Your message in **{server}** was removed because a security check confirmed it is malicious:\n{findings}\nIf you did not mean to send it, your account or device may be compromised: change your password and scan your device.',
  replies: {
    noPermission: 'You need the Manage Server permission to use /safety.',
    enabled:
      'Scanning is on. Messages are only removed when a check confirms a threat; anything unknown stays up. Removals are reported in the moderation log (/moderation log).',
    disabled: 'Scanning is off.',
    timeoutSet: 'Members whose message is removed will be timed out for {minutes} minutes.',
    timeoutOff: 'Members whose message is removed will not be timed out.',
    statusTitle: 'Safety scanning',
    statusState: 'Status',
    statusOn: 'On',
    statusOff: 'Off',
    statusTimeout: 'Timeout',
    statusTimeoutMinutes: '{minutes} minutes',
    statusTimeoutOff: 'None',
    statusSources: 'Checks',
    sourceOn: '✅ {source}',
    sourceList: '✅ {source} ({count} domains)',
    sourceOff: '➖ {source} (not configured on this bot)',
    sourceDown: '⚠️ {source} (configured, but not answering)',
    statusWarnings: 'Warnings',
    noMessageContent:
      'The bot runs without the Message Content intent, so it cannot see links or files.',
    noManageMessages: 'I need the Manage Messages permission to remove messages.',
    noLogChannel:
      'No moderation log channel is set, so removals are not reported. Use /moderation log.',
  },
} as const;
