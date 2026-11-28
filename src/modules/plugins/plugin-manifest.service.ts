import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  type GatewayIntentBits,
  InteractionContextType,
  Locale,
  PermissionFlagsBits,
  PermissionsBitField,
  type RESTPostAPIApplicationCommandsJSONBody,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import { z } from 'zod';
import { Injectable } from '@/core';
import { channelSchema, contextKinds, guildSchema, memberSchema } from './discord-data.service';

const name = z
  .string()
  .regex(/^[-_\p{L}\p{N}]{1,32}$/u, 'lowercase letters, numbers, - or _, up to 32')
  .refine((value) => value === value.toLowerCase(), 'must be lowercase');
const description = z.string().min(1).max(100);
const localizations = <T extends z.ZodType>(value: T) =>
  z.partialRecord(z.enum(Object.values(Locale) as [Locale, ...Locale[]]), value).optional();

const optionTypes = {
  string: ApplicationCommandOptionType.String,
  integer: ApplicationCommandOptionType.Integer,
  number: ApplicationCommandOptionType.Number,
  boolean: ApplicationCommandOptionType.Boolean,
  user: ApplicationCommandOptionType.User,
  channel: ApplicationCommandOptionType.Channel,
  role: ApplicationCommandOptionType.Role,
} as const;

const option = z
  .object({
    type: z.enum(
      Object.keys(optionTypes) as [keyof typeof optionTypes, ...(keyof typeof optionTypes)[]],
    ),
    name,
    description,
    nameLocalizations: localizations(name),
    descriptionLocalizations: localizations(description),
    required: z.boolean().optional(),
    choices: z
      .array(z.object({ name: description, value: z.union([z.string().max(100), z.number()]) }))
      .max(25)
      .optional(),
    autocomplete: z.boolean().optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    minLength: z.number().int().min(0).max(6000).optional(),
    maxLength: z.number().int().min(1).max(6000).optional(),
  })
  .refine((o) => !(o.choices && o.autocomplete), 'choices and autocomplete are exclusive');

const optionList = z
  .array(option)
  .max(25)
  .refine(
    (options) =>
      options.every((o, i) => !o.required || options.slice(0, i).every((p) => p.required)),
    'required options must come before optional ones',
  )
  .optional();

const subcommand = z.object({
  name,
  description,
  nameLocalizations: localizations(name),
  descriptionLocalizations: localizations(description),
  options: optionList,
});

const permissionName = z.enum(
  Object.keys(PermissionFlagsBits) as [
    keyof typeof PermissionFlagsBits,
    ...(keyof typeof PermissionFlagsBits)[],
  ],
);

export const commandSchema = z
  .object({
    name,
    description,
    nameLocalizations: localizations(name),
    descriptionLocalizations: localizations(description),
    options: optionList,
    subcommands: z.array(subcommand).max(25).optional(),
    defaultMemberPermissions: z.array(permissionName).optional(),
    guildOnly: z.boolean().default(true),
  })
  .refine(
    (c) => !(c.options?.length && c.subcommands?.length),
    'a command has options or subcommands, not both',
  );

/** Discord shows context menu names as typed, so unlike commands they allow spaces and capitals. */
export const contextMenuSchema = z.object({
  type: z.enum(['user', 'message']),
  name: z.string().min(1).max(32),
  nameLocalizations: localizations(z.string().min(1).max(32)),
  defaultMemberPermissions: z.array(permissionName).optional(),
});

export const pluginEvents = {
  messageCreate: 'events.messages',
  memberJoin: 'events.members',
  memberLeave: 'events.members',
  reactionAdd: 'events.reactions',
  levelUp: 'events.levels',
  caseCreated: 'events.moderation',
} as const;
export type PluginEvent = keyof typeof pluginEvents;

/**
 * Intents from https://discord.com/developers/docs/events/gateway#list-of-intents. Left out on
 * purpose: INTERACTION_CREATE and VOICE_SERVER_UPDATE carry tokens that act as the bot,
 * GUILD_CREATE is a full server dump, and events without a server don't belong to one.
 */
export const gatewayEvents = {
  GUILD_UPDATE: 'Guilds',
  GUILD_DELETE: 'Guilds',
  GUILD_ROLE_CREATE: 'Guilds',
  GUILD_ROLE_UPDATE: 'Guilds',
  GUILD_ROLE_DELETE: 'Guilds',
  CHANNEL_CREATE: 'Guilds',
  CHANNEL_UPDATE: 'Guilds',
  CHANNEL_DELETE: 'Guilds',
  CHANNEL_PINS_UPDATE: 'Guilds',
  THREAD_CREATE: 'Guilds',
  THREAD_UPDATE: 'Guilds',
  THREAD_DELETE: 'Guilds',
  THREAD_LIST_SYNC: 'Guilds',
  THREAD_MEMBER_UPDATE: 'Guilds',
  STAGE_INSTANCE_CREATE: 'Guilds',
  STAGE_INSTANCE_UPDATE: 'Guilds',
  STAGE_INSTANCE_DELETE: 'Guilds',
  GUILD_MEMBER_ADD: 'GuildMembers',
  GUILD_MEMBER_UPDATE: 'GuildMembers',
  GUILD_MEMBER_REMOVE: 'GuildMembers',
  THREAD_MEMBERS_UPDATE: 'GuildMembers',
  GUILD_AUDIT_LOG_ENTRY_CREATE: 'GuildModeration',
  GUILD_BAN_ADD: 'GuildModeration',
  GUILD_BAN_REMOVE: 'GuildModeration',
  GUILD_EMOJIS_UPDATE: 'GuildExpressions',
  GUILD_STICKERS_UPDATE: 'GuildExpressions',
  GUILD_SOUNDBOARD_SOUND_CREATE: 'GuildExpressions',
  GUILD_SOUNDBOARD_SOUND_UPDATE: 'GuildExpressions',
  GUILD_SOUNDBOARD_SOUND_DELETE: 'GuildExpressions',
  GUILD_SOUNDBOARD_SOUNDS_UPDATE: 'GuildExpressions',
  GUILD_INTEGRATIONS_UPDATE: 'GuildIntegrations',
  INTEGRATION_CREATE: 'GuildIntegrations',
  INTEGRATION_UPDATE: 'GuildIntegrations',
  INTEGRATION_DELETE: 'GuildIntegrations',
  WEBHOOKS_UPDATE: 'GuildWebhooks',
  INVITE_CREATE: 'GuildInvites',
  INVITE_DELETE: 'GuildInvites',
  VOICE_STATE_UPDATE: 'GuildVoiceStates',
  VOICE_CHANNEL_EFFECT_SEND: 'GuildVoiceStates',
  PRESENCE_UPDATE: 'GuildPresences',
  MESSAGE_CREATE: 'GuildMessages',
  MESSAGE_UPDATE: 'GuildMessages',
  MESSAGE_DELETE: 'GuildMessages',
  MESSAGE_DELETE_BULK: 'GuildMessages',
  MESSAGE_REACTION_ADD: 'GuildMessageReactions',
  MESSAGE_REACTION_REMOVE: 'GuildMessageReactions',
  MESSAGE_REACTION_REMOVE_ALL: 'GuildMessageReactions',
  MESSAGE_REACTION_REMOVE_EMOJI: 'GuildMessageReactions',
  TYPING_START: 'GuildMessageTyping',
  GUILD_SCHEDULED_EVENT_CREATE: 'GuildScheduledEvents',
  GUILD_SCHEDULED_EVENT_UPDATE: 'GuildScheduledEvents',
  GUILD_SCHEDULED_EVENT_DELETE: 'GuildScheduledEvents',
  GUILD_SCHEDULED_EVENT_USER_ADD: 'GuildScheduledEvents',
  GUILD_SCHEDULED_EVENT_USER_REMOVE: 'GuildScheduledEvents',
  AUTO_MODERATION_RULE_CREATE: 'AutoModerationConfiguration',
  AUTO_MODERATION_RULE_UPDATE: 'AutoModerationConfiguration',
  AUTO_MODERATION_RULE_DELETE: 'AutoModerationConfiguration',
  AUTO_MODERATION_ACTION_EXECUTION: 'AutoModerationExecution',
  MESSAGE_POLL_VOTE_ADD: 'GuildMessagePolls',
  MESSAGE_POLL_VOTE_REMOVE: 'GuildMessagePolls',
} as const satisfies Record<string, keyof typeof GatewayIntentBits>;
export type GatewayEvent = keyof typeof gatewayEvents;
const gatewayEventName = z.enum(Object.keys(gatewayEvents) as [GatewayEvent, ...GatewayEvent[]]);

export const intentPermission = (intent: keyof typeof GatewayIntentBits) => `intents.${intent}`;
/**
 * Without it, messages reach plugins without content, embeds, attachments, components and polls,
 * as Discord does for bots without the Message Content intent.
 */
export const messageContentPermission = intentPermission('MessageContent');
const eventName = z.enum(Object.keys(pluginEvents) as [PluginEvent, ...PluginEvent[]]);

export const manifestSchema = z.object({
  name: z.string().min(1).max(32),
  version: z.string().max(32),
  commands: z.array(commandSchema).max(25).default([]),
  // Discord allows 5 menus of each type per bot, the built-in ones included.
  contextMenus: z
    .array(contextMenuSchema)
    .max(10)
    .default([])
    .refine(
      (menus) => ['user', 'message'].every((t) => menus.filter((m) => m.type === t).length <= 5),
      'at most 5 user menus and 5 message menus',
    ),
  events: z.array(eventName).max(Object.keys(pluginEvents).length).default([]),
  discordEvents: z.array(gatewayEventName).max(Object.keys(gatewayEvents).length).default([]),
  uses: z.array(z.string().max(64)).max(50).default([]),
  context: z.array(z.enum(contextKinds)).default([]),
});

const optionValue = z.union([z.string(), z.number(), z.boolean()]);
export const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.number(),
  position: z.number(),
});
export const messageSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  authorId: z.string(),
  content: z.string(),
  attachments: z.array(z.string()),
});

export const invocationSchema = z.object({
  kind: z.enum(['command', 'autocomplete', 'userMenu', 'messageMenu', 'button', 'select', 'modal']),
  /** The command or menu name; empty for buttons, selects and forms. */
  command: z.string(),
  subcommand: z.string().nullable(),
  options: z.record(z.string(), optionValue),
  userId: z.string(),
  guildId: z.string(),
  channelId: z.string(),
  locale: z.string(),
  /** The caller's permission names in this channel, e.g. "ManageMessages". */
  permissions: z.array(z.string()),
  context: z
    .object({
      member: memberSchema.optional(),
      guild: guildSchema.optional(),
      channel: channelSchema.optional(),
    })
    .optional(),
  resolved: z
    .object({
      members: z.record(z.string(), memberSchema),
      roles: z.record(z.string(), roleSchema),
      channels: z.record(z.string(), channelSchema),
    })
    .optional(),
  /** Autocomplete: the option being typed. */
  focused: z.object({ name: z.string(), value: z.string() }).optional(),
  /** Context menus: the member or message that was right-clicked. */
  target: z
    .object({
      userId: z.string(),
      member: memberSchema.nullable(),
      message: messageSchema.nullable(),
    })
    .optional(),
  /** Buttons, selects and forms: which one, what was picked or typed, and the message it is on. */
  component: z
    .object({
      id: z.string(),
      values: z.array(z.string()),
      fields: z.record(z.string(), z.string()),
      messageId: z.string().nullable(),
    })
    .optional(),
});

const memberEvent = z.object({ member: memberSchema });
export const eventDataSchemas = {
  messageCreate: z.object({ message: messageSchema, member: memberSchema.nullable() }),
  memberJoin: memberEvent,
  memberLeave: z.object({ userId: z.string(), username: z.string(), roles: z.array(z.string()) }),
  reactionAdd: z.object({
    messageId: z.string(),
    channelId: z.string(),
    userId: z.string(),
    emoji: z.string(),
  }),
  levelUp: z.object({ userId: z.string(), level: z.number(), xp: z.number() }),
  caseCreated: z.object({
    number: z.number(),
    action: z.string(),
    targetId: z.string(),
    moderatorId: z.string(),
    reason: z.string().nullable(),
    durationSeconds: z.number().nullable(),
  }),
} satisfies Record<PluginEvent, z.ZodType>;

/** What `handle_event` receives. `data` has the shape of `eventDataSchemas[event]`. */
export const eventInputSchema = z.object({
  event: z.union([eventName, gatewayEventName]),
  guildId: z.string(),
  channelId: z.string().nullable(),
  data: z.record(z.string(), z.unknown()),
});

/** What `handle_job` receives: what the plugin passed to `schedule.create`. */
export const jobInputSchema = z.object({
  key: z.string().nullable(),
  guildId: z.string(),
  channelId: z.string().nullable(),
  data: z.unknown(),
});

/** Plugin ids for buttons, selects and forms; the bot prefixes them with the plugin's id. */
export const componentId = z
  .string()
  .regex(/^[\w:.-]{1,60}$/, 'letters, numbers, _ : . or -, up to 60');

const embedSchema = z
  .object({
    title: z.string().max(256).optional(),
    description: z.string().max(4096).optional(),
    url: z.url().optional(),
    color: z.number().int().min(0).max(0xffffff).optional(),
    fields: z
      .array(
        z.object({
          name: z.string().min(1).max(256),
          value: z.string().min(1).max(1024),
          inline: z.boolean().optional(),
        }),
      )
      .max(25)
      .optional(),
    author: z.object({ name: z.string().min(1).max(256), iconUrl: z.url().optional() }).optional(),
    footer: z.object({ text: z.string().min(1).max(2048), iconUrl: z.url().optional() }).optional(),
    image: z.url().optional(),
    thumbnail: z.url().optional(),
    timestamp: z.iso.datetime({ offset: true }).optional(),
  })
  .refine(
    (e) =>
      (e.title?.length ?? 0) +
        (e.description?.length ?? 0) +
        (e.author?.name.length ?? 0) +
        (e.footer?.text.length ?? 0) +
        (e.fields ?? []).reduce((n, f) => n + f.name.length + f.value.length, 0) <=
      6000,
    'an embed holds at most 6000 characters',
  );

const emoji = z.string().min(1).max(64);
const buttonSchema = z
  .object({
    type: z.literal('button'),
    style: z.enum(['primary', 'secondary', 'success', 'danger', 'link']).default('secondary'),
    label: z.string().min(1).max(80).optional(),
    emoji: emoji.optional(),
    id: componentId.optional(),
    url: z.url().optional(),
    disabled: z.boolean().optional(),
  })
  .refine((b) => b.label || b.emoji, 'a button needs a label or an emoji')
  .refine(
    (b) => (b.style === 'link' ? !!b.url && !b.id : !!b.id && !b.url),
    'link buttons need a url; other buttons need an id',
  );
const selectSchema = z
  .object({
    type: z.literal('select'),
    id: componentId,
    menu: z.enum(['string', 'user', 'role', 'channel']).default('string'),
    placeholder: z.string().max(150).optional(),
    min: z.number().int().min(0).max(25).optional(),
    max: z.number().int().min(1).max(25).optional(),
    disabled: z.boolean().optional(),
    options: z
      .array(
        z.object({
          label: z.string().min(1).max(100),
          value: z.string().min(1).max(100),
          description: z.string().max(100).optional(),
          emoji: emoji.optional(),
          default: z.boolean().optional(),
        }),
      )
      .max(25)
      .optional(),
  })
  .refine(
    (s) => (s.menu === 'string' ? (s.options?.length ?? 0) > 0 : !s.options),
    'string selects need options; user, role and channel selects take none',
  );
const rowSchema = z.union([z.array(buttonSchema).min(1).max(5), z.tuple([selectSchema])]);

export const messageBodySchema = z
  .object({
    content: z.string().max(2000).optional(),
    embeds: z.array(embedSchema).max(10).optional(),
    components: z.array(rowSchema).max(5).optional(),
  })
  .refine((m) => m.content || m.embeds?.length, 'a message needs content or an embed');

const modalSchema = z.object({
  type: z.literal('modal'),
  id: componentId,
  title: z.string().min(1).max(45),
  fields: z
    .array(
      z.object({
        id: componentId,
        label: z.string().min(1).max(45),
        style: z.enum(['short', 'paragraph']).default('short'),
        required: z.boolean().default(true),
        placeholder: z.string().max(100).optional(),
        value: z.string().max(4000).optional(),
        minLength: z.number().int().min(0).max(4000).optional(),
        maxLength: z.number().int().min(1).max(4000).optional(),
      }),
    )
    .min(1)
    .max(5),
});

export const actionSchema = z.discriminatedUnion('type', [
  messageBodySchema.safeExtend({ type: z.literal('reply'), ephemeral: z.boolean().optional() }),
  messageBodySchema.safeExtend({ type: z.literal('update') }),
  modalSchema,
]);

/** What `handle_command` and `handle_component` return. */
export const responseSchema = z
  .object({ actions: z.array(actionSchema).max(5) })
  .refine(
    (r) => r.actions.every((a, i) => a.type !== 'modal' || (i === 0 && r.actions.length === 1)),
    'a modal must be the only action',
  );

/** What `autocomplete` returns. */
export const choicesSchema = z.object({
  choices: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        value: z.union([z.string().max(100), z.number()]),
      }),
    )
    .max(25),
});

export type Invocation = z.infer<typeof invocationSchema>;
export type EventInput = z.infer<typeof eventInputSchema>;
export type JobInput = z.infer<typeof jobInputSchema>;
export type PluginAction = z.infer<typeof actionSchema>;
export type MessageBody = z.infer<typeof messageBodySchema>;
export type PluginChoice = z.infer<typeof choicesSchema>['choices'][number];
export type PluginCommandSpec = z.infer<typeof commandSchema>;
export type PluginContextMenuSpec = z.infer<typeof contextMenuSchema>;
export type PluginManifest = z.infer<typeof manifestSchema>;
type OptionSpec = z.infer<typeof option>;

function optionJSON(spec: OptionSpec) {
  return {
    type: optionTypes[spec.type],
    name: spec.name,
    description: spec.description,
    name_localizations: spec.nameLocalizations,
    description_localizations: spec.descriptionLocalizations,
    required: spec.required ?? false,
    ...(spec.choices && { choices: spec.choices }),
    ...(spec.autocomplete && { autocomplete: true }),
    ...(spec.minValue !== undefined && { min_value: spec.minValue }),
    ...(spec.maxValue !== undefined && { max_value: spec.maxValue }),
    ...(spec.minLength !== undefined && { min_length: spec.minLength }),
    ...(spec.maxLength !== undefined && { max_length: spec.maxLength }),
  };
}

const permissionBits = (names: string[] | undefined) =>
  names && new PermissionsBitField(names as (keyof typeof PermissionFlagsBits)[]).bitfield;

@Injectable()
export class PluginManifestService {
  parse(raw: unknown): PluginManifest {
    return manifestSchema.parse(raw);
  }

  requiredPermissions(spec: { defaultMemberPermissions?: string[] }): bigint | undefined {
    return permissionBits(spec.defaultMemberPermissions);
  }

  toCommandJSON(spec: PluginCommandSpec): RESTPostAPIChatInputApplicationCommandsJSONBody {
    const options = spec.subcommands?.length
      ? spec.subcommands.map((sub) => ({
          type: ApplicationCommandOptionType.Subcommand,
          name: sub.name,
          description: sub.description,
          name_localizations: sub.nameLocalizations,
          description_localizations: sub.descriptionLocalizations,
          options: (sub.options ?? []).map(optionJSON),
        }))
      : (spec.options ?? []).map(optionJSON);
    const required = permissionBits(spec.defaultMemberPermissions);
    return {
      type: ApplicationCommandType.ChatInput,
      name: spec.name,
      description: spec.description,
      name_localizations: spec.nameLocalizations,
      description_localizations: spec.descriptionLocalizations,
      options,
      ...(required !== undefined && { default_member_permissions: required.toString() }),
      ...(spec.guildOnly && { contexts: [InteractionContextType.Guild] }),
    } as RESTPostAPIChatInputApplicationCommandsJSONBody;
  }

  toContextMenuJSON(spec: PluginContextMenuSpec): RESTPostAPIApplicationCommandsJSONBody {
    const required = permissionBits(spec.defaultMemberPermissions);
    return {
      type: spec.type === 'user' ? ApplicationCommandType.User : ApplicationCommandType.Message,
      name: spec.name,
      name_localizations: spec.nameLocalizations,
      contexts: [InteractionContextType.Guild],
      ...(required !== undefined && { default_member_permissions: required.toString() }),
    } as RESTPostAPIApplicationCommandsJSONBody;
  }
}
