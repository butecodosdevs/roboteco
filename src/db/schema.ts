import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

export const guilds = pgTable('guilds', {
  id: text('id').primaryKey(),
  locale: text('locale').notNull().default('en-US'),
  honeypotChannelId: text('honeypot_channel_id'),
  honeypotDeleteMessageSeconds: integer('honeypot_delete_message_seconds').notNull().default(3600),
  moderationLogChannelId: text('moderation_log_channel_id'),
  moderationDmUsers: boolean('moderation_dm_users').notNull().default(true),
  moderationCaseCount: integer('moderation_case_count').notNull().default(0),
  suggestionsChannelId: text('suggestions_channel_id'),
  reportsChannelId: text('reports_channel_id'),
  ticketsStaffRoleId: text('tickets_staff_role_id'),
  rolePanelChannelId: text('role_panel_channel_id'),
  rolePanelMessageId: text('role_panel_message_id'),
  levelUpAnnounce: boolean('level_up_announce').notNull().default(true),
  starboardChannelId: text('starboard_channel_id'),
  starboardThreshold: integer('starboard_threshold').notNull().default(3),
  welcomeChannelId: text('welcome_channel_id'),
  welcomeMessage: text('welcome_message'),
  welcomeRoleId: text('welcome_role_id'),
  serverLogChannelId: text('server_log_channel_id'),
  serverLogDisabledEvents: jsonb('server_log_disabled_events')
    .$type<string[]>()
    .notNull()
    .default([]),
  serverLogIgnoredChannels: jsonb('server_log_ignored_channels')
    .$type<string[]>()
    .notNull()
    .default([]),
  embedsEnabled: boolean('embeds_enabled').notNull().default(false),
  purgeJobId: integer('purge_job_id'),
  escalationWarnings: integer('escalation_warnings'),
  escalationAction: text('escalation_action', { enum: ['timeout', 'kick', 'ban'] }),
  escalationDurationSeconds: integer('escalation_duration_seconds'),
  warnExpiryDays: integer('warn_expiry_days').notNull().default(30),
  verificationRoleId: text('verification_role_id'),
  verificationMinAccountAgeDays: integer('verification_min_account_age_days').notNull().default(0),
  antiraidJoins: integer('antiraid_joins'),
  antiraidSeconds: integer('antiraid_seconds').notNull().default(10),
  antiraidLocked: boolean('antiraid_locked').notNull().default(false),
  antiraidPreviousLevel: integer('antiraid_previous_level'),
  birthdayChannelId: text('birthday_channel_id'),
  birthdayRoleId: text('birthday_role_id'),
  safetyEnabled: boolean('safety_enabled').notNull().default(false),
  safetyTimeoutMinutes: integer('safety_timeout_minutes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Guild = typeof guilds.$inferSelect;
export type NewGuild = typeof guilds.$inferInsert;

export const moderationActions = ['warn', 'timeout', 'untimeout', 'kick', 'ban', 'unban'] as const;

export const moderationCases = pgTable(
  'moderation_cases',
  {
    id: serial('id').primaryKey(),
    guildId: text('guild_id').notNull(),
    number: integer('number').notNull(),
    action: text('action', { enum: moderationActions }).notNull(),
    targetId: text('target_id').notNull(),
    moderatorId: text('moderator_id').notNull(),
    reason: text('reason'),
    durationSeconds: integer('duration_seconds'),
    logChannelId: text('log_channel_id'),
    logMessageId: text('log_message_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.guildId, table.number),
    index('moderation_cases_target_idx').on(table.guildId, table.targetId),
  ],
);

export const scheduledJobs = pgTable(
  'scheduled_jobs',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    payload: jsonb('payload').notNull(),
    runAt: timestamp('run_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('scheduled_jobs_run_at_idx').on(table.runAt)],
);

export const tags = pgTable(
  'tags',
  {
    guildId: text('guild_id').notNull(),
    name: text('name').notNull(),
    content: text('content').notNull(),
    authorId: text('author_id').notNull(),
    uses: integer('uses').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.name] })],
);

export const suggestionStatuses = ['pending', 'approved', 'denied'] as const;

export const suggestions = pgTable('suggestions', {
  id: serial('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  authorId: text('author_id').notNull(),
  content: text('content').notNull(),
  status: text('status', { enum: suggestionStatuses }).notNull().default('pending'),
  channelId: text('channel_id'),
  messageId: text('message_id'),
  decidedBy: text('decided_by'),
  decisionReason: text('decision_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const suggestionVotes = pgTable(
  'suggestion_votes',
  {
    suggestionId: integer('suggestion_id')
      .notNull()
      .references(() => suggestions.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    value: smallint('value').notNull(),
  },
  (table) => [primaryKey({ columns: [table.suggestionId, table.userId] })],
);

export const selfRoles = pgTable(
  'self_roles',
  {
    guildId: text('guild_id').notNull(),
    roleId: text('role_id').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.roleId] })],
);

export const reportStatuses = ['open', 'resolved', 'dismissed'] as const;

export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  reporterId: text('reporter_id').notNull(),
  targetId: text('target_id').notNull(),
  channelId: text('channel_id'),
  messageId: text('message_id'),
  excerpt: text('excerpt'),
  reason: text('reason').notNull(),
  status: text('status', { enum: reportStatuses }).notNull().default('open'),
  handledBy: text('handled_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tickets = pgTable(
  'tickets',
  {
    id: serial('id').primaryKey(),
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    threadId: text('thread_id').notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('tickets_owner_idx').on(table.guildId, table.userId)],
);

export const memberLevels = pgTable(
  'member_levels',
  {
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    xp: integer('xp').notNull().default(0),
    level: integer('level').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.guildId, table.userId] }),
    index('member_levels_xp_idx').on(table.guildId, table.xp),
  ],
);

export const levelRewards = pgTable(
  'level_rewards',
  {
    guildId: text('guild_id').notNull(),
    level: integer('level').notNull(),
    roleId: text('role_id').notNull(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.level] })],
);

export const starboardEntries = pgTable('starboard_entries', {
  messageId: text('message_id').primaryKey(),
  guildId: text('guild_id').notNull(),
  channelId: text('channel_id').notNull(),
  starboardMessageId: text('starboard_message_id').notNull(),
  stars: integer('stars').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reminders = pgTable(
  'reminders',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    guildId: text('guild_id'),
    channelId: text('channel_id'),
    text: text('text').notNull(),
    remindAt: timestamp('remind_at', { withTimezone: true }).notNull(),
    jobId: integer('job_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('reminders_user_idx').on(table.userId)],
);

export const tempBans = pgTable(
  'temp_bans',
  {
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    jobId: integer('job_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.userId] })],
);

export const giveaways = pgTable('giveaways', {
  id: serial('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  channelId: text('channel_id').notNull(),
  messageId: text('message_id'),
  hostId: text('host_id').notNull(),
  prize: text('prize').notNull(),
  winnersCount: integer('winners_count').notNull(),
  winnerIds: jsonb('winner_ids').$type<string[]>().notNull().default([]),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  jobId: integer('job_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const giveawayEntries = pgTable(
  'giveaway_entries',
  {
    giveawayId: integer('giveaway_id')
      .notNull()
      .references(() => giveaways.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
  },
  (table) => [primaryKey({ columns: [table.giveawayId, table.userId] })],
);

export const postRepeats = ['none', 'daily', 'weekly'] as const;

export const scheduledPosts = pgTable('scheduled_posts', {
  id: serial('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  channelId: text('channel_id').notNull(),
  content: text('content').notNull(),
  repeat: text('repeat', { enum: postRepeats }).notNull().default('none'),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull(),
  jobId: integer('job_id'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const birthdays = pgTable(
  'birthdays',
  {
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    month: smallint('month').notNull(),
    day: smallint('day').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.guildId, table.userId] }),
    index('birthdays_date_idx').on(table.month, table.day),
  ],
);

export const feeds = pgTable('feeds', {
  id: serial('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  channelId: text('channel_id').notNull(),
  url: text('url').notNull(),
  title: text('title').notNull(),
  seenIds: jsonb('seen_ids').$type<string[]>().notNull().default([]),
  failures: integer('failures').notNull().default(0),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const customCommands = pgTable(
  'custom_commands',
  {
    guildId: text('guild_id').notNull(),
    name: text('name').notNull(),
    response: text('response').notNull(),
    description: text('description').notNull(),
    commandId: text('command_id'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.name] })],
);

export const countingChannels = pgTable('counting_channels', {
  guildId: text('guild_id').primaryKey(),
  channelId: text('channel_id').notNull(),
  current: integer('current').notNull().default(0),
  lastUserId: text('last_user_id'),
  record: integer('record').notNull().default(0),
});

export const inviteJoins = pgTable(
  'invite_joins',
  {
    guildId: text('guild_id').notNull(),
    memberId: text('member_id').notNull(),
    inviterId: text('inviter_id'),
    code: text('code'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp('left_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.guildId, table.memberId] }),
    index('invite_joins_inviter_idx').on(table.guildId, table.inviterId),
  ],
);

export const dropChannels = pgTable('drop_channels', {
  channelId: text('channel_id').primaryKey(),
  guildId: text('guild_id').notNull(),
  every: integer('every').notNull(),
  xp: integer('xp').notNull(),
  lifetimeSeconds: integer('lifetime_seconds').notNull().default(60),
  winners: integer('winners').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dropClaims = pgTable(
  'drop_claims',
  {
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    claims: integer('claims').notNull().default(0),
    xp: integer('xp').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.guildId, table.userId] }),
    index('drop_claims_rank_idx').on(table.guildId, table.claims),
  ],
);

export const tempVoiceHubs = pgTable('temp_voice_hubs', {
  channelId: text('channel_id').primaryKey(),
  guildId: text('guild_id').notNull(),
  categoryId: text('category_id'),
  userLimit: integer('user_limit').notNull().default(0),
  emptyTimeoutSeconds: integer('empty_timeout_seconds').notNull().default(60),
  idleTimeoutSeconds: integer('idle_timeout_seconds').notNull().default(600),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tempVoiceChannels = pgTable(
  'temp_voice_channels',
  {
    channelId: text('channel_id').primaryKey(),
    guildId: text('guild_id').notNull(),
    hubId: text('hub_id').notNull(),
    ownerId: text('owner_id').notNull(),
    closeJobId: integer('close_job_id'),
    closeReason: text('close_reason', { enum: ['empty', 'idle'] }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('temp_voice_owner_idx').on(table.guildId, table.ownerId)],
);

export const pluginKv = pgTable(
  'plugin_kv',
  {
    pluginId: text('plugin_id').notNull(),
    guildId: text('guild_id').notNull(),
    key: text('key').notNull(),
    value: text('value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.pluginId, table.guildId, table.key] })],
);

/** Messages a plugin posted, so it can edit or delete its own messages and nobody else's. */
export const pluginMessages = pgTable(
  'plugin_messages',
  {
    messageId: text('message_id').primaryKey(),
    pluginId: text('plugin_id').notNull(),
    guildId: text('guild_id').notNull(),
    channelId: text('channel_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('plugin_messages_guild_idx').on(table.guildId)],
);

/** One row per command run, so the panel can chart usage without a metrics backend. */
export const commandUsage = pgTable(
  'command_usage',
  {
    id: serial('id').primaryKey(),
    guildId: text('guild_id').notNull(),
    command: text('command').notNull(),
    userId: text('user_id').notNull(),
    source: text('source', { enum: ['builtin', 'plugin'] }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('command_usage_guild_idx').on(table.guildId, table.usedAt),
    index('command_usage_command_idx').on(table.guildId, table.command, table.usedAt),
  ],
);

export const reactionRoles = pgTable(
  'reaction_roles',
  {
    messageId: text('message_id').notNull(),
    emoji: text('emoji').notNull(),
    guildId: text('guild_id').notNull(),
    channelId: text('channel_id').notNull(),
    roleId: text('role_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.messageId, table.emoji] }),
    index('reaction_roles_guild_idx').on(table.guildId),
  ],
);
