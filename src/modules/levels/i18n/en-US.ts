export const levelsEnUS = {
  rank: { name: 'rank', description: "Show your level, or someone else's" },
  leaderboard: { name: 'leaderboard', description: 'Top members by XP' },
  command: { name: 'levels', description: 'Configure levels' },
  reward: { name: 'reward', description: 'Give a role when members reach a level' },
  unreward: { name: 'unreward', description: 'Remove a level reward' },
  announce: { name: 'announce', description: 'Choose whether level-ups are announced in chat' },
  options: {
    user: { name: 'user', description: 'Whose rank to show' },
    level: { name: 'level', description: 'Level' },
    role: { name: 'role', description: 'Role to give' },
    enabled: { name: 'enabled', description: 'Post level-up messages' },
  },
  card: {
    level: 'Level',
    xp: 'XP',
    rank: 'Rank',
    progress: '{current} / {needed} XP to level {next}',
  },
  board: {
    title: 'Leaderboard',
    line: '**{position}.** {user} · level {level} · {xp} XP',
  },
  levelUp: 'GG {user}, you reached level **{level}**!',
  replies: {
    noXp: '{user} has no XP yet.',
    empty: 'Nobody has earned XP yet.',
    rewardSet: 'Members reaching level {level} get {role}.',
    rewardRemoved: 'Removed the reward for level {level}.',
    noReward: 'There is no reward for level {level}.',
    announceOn: 'Level-ups will be announced.',
    announceOff: 'Level-ups will not be announced.',
    unassignable:
      "I can't assign {role}: it is managed by an integration or is not below my highest role.",
  },
} as const;
