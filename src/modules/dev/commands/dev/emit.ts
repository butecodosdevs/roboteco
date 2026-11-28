import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  type SlashCommandSubcommandBuilder,
  type VoiceBasedChannel,
} from 'discord.js';
import type { GuildInteraction } from '@/core';
import { defaultLocale, localizations, localize, t, translator } from '@/i18n';
import { logger } from '@/logger';
import type { AuditService } from '@/modules/logs/audit.service';
import {
  build,
  type Emission,
  groups,
  type Scenario,
  ScenarioError,
  type TargetOption,
  uses,
} from './scenarios';

type Group = keyof typeof groups;

// Listeners that do more than log, so the caller knows what else a fake event touched.
const sideEffects: Partial<Record<Scenario, 'join' | 'leave' | 'channelDelete'>> = {
  memberJoin: 'join',
  memberLeave: 'leave',
  memberKick: 'leave',
  channelDelete: 'channelDelete',
};

const textChannelTypes = [
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildVoice,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
] as const;

const anyChannelTypes = [
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildCategory,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
  ChannelType.GuildStageVoice,
] as const;

/** The `scenario` choice for one group, then whatever target options that group needs. */
export function scenarioOption(builder: SlashCommandSubcommandBuilder, group: Group) {
  return builder.addStringOption((opt) =>
    localize(opt, 'dev.options.scenario')
      .setRequired(true)
      .addChoices(
        ...groups[group].map((scenario) => ({
          name: t(defaultLocale, `dev.scenarios.${scenario}`),
          name_localizations: localizations(`dev.scenarios.${scenario}`),
          value: scenario,
        })),
      ),
  );
}

const voiceChannelTypes = [ChannelType.GuildVoice, ChannelType.GuildStageVoice] as const;

export const targetOptions = {
  voiceChannel: (b: SlashCommandSubcommandBuilder) =>
    b.addChannelOption((opt) =>
      localize(opt, 'dev.options.voiceChannel').addChannelTypes(...voiceChannelTypes),
    ),
  messageChannel: (b: SlashCommandSubcommandBuilder) =>
    b.addChannelOption((opt) =>
      localize(opt, 'dev.options.messageChannel').addChannelTypes(...textChannelTypes),
    ),
  channel: (b: SlashCommandSubcommandBuilder) =>
    b.addChannelOption((opt) =>
      localize(opt, 'dev.options.channel').addChannelTypes(...anyChannelTypes),
    ),
  author: (b: SlashCommandSubcommandBuilder) =>
    b.addUserOption((opt) => localize(opt, 'dev.options.author')),
  count: (b: SlashCommandSubcommandBuilder) =>
    b.addIntegerOption((opt) => localize(opt, 'dev.options.count').setMinValue(1).setMaxValue(50)),
  member: (b: SlashCommandSubcommandBuilder) =>
    b.addUserOption((opt) => localize(opt, 'dev.options.member')),
  role: (b: SlashCommandSubcommandBuilder, required = false) =>
    b.addRoleOption((opt) => localize(opt, 'dev.options.role').setRequired(required)),
};

/** `actor` and `reason` go last: Discord lists required options first, then these. */
export function auditOptions(builder: SlashCommandSubcommandBuilder) {
  return builder
    .addUserOption((opt) => localize(opt, 'dev.options.actor'))
    .addStringOption((opt) => localize(opt, 'dev.options.reason').setMaxLength(200));
}

export async function emitScenario(interaction: GuildInteraction, audit: AuditService) {
  const tr = translator(interaction.locale);
  const reply = (content: string) =>
    interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return reply(tr('dev.replies.adminOnly'));
  }
  const { guild, client, options } = interaction;
  const scenario = options.getString('scenario', true) as Scenario;

  const user = options.getUser('member') ?? interaction.user;
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return reply(tr('dev.replies.notMember'));

  const picked = options.getChannel('channel');
  const channel = picked ? (guild.channels.cache.get(picked.id) ?? null) : interaction.channel;
  const actor = options.getUser('actor');
  const reason = options.getString('reason');

  let emission: Emission;
  try {
    emission = await build(scenario, {
      client,
      guild,
      member,
      textChannel: channel?.isTextBased() ? channel : null,
      channel: channel && !channel.isThread() ? channel : null,
      author: options.getUser('author'),
      voiceChannel:
        (picked && guild.channels.cache.get(picked.id)?.isVoiceBased()
          ? (guild.channels.cache.get(picked.id) as VoiceBasedChannel)
          : null) ?? member.voice.channel,
      role: options.getRole('role'),
      count: options.getInteger('count') ?? 5,
    });
  } catch (error) {
    if (error instanceof ScenarioError) return reply(tr(`dev.replies.${error.key}`));
    throw error;
  }

  if (actor && emission.audit)
    audit.simulate(guild.id, { ...emission.audit, executorId: actor.id, reason });
  logger.info({ guild: guild.id, scenario, by: interaction.user.id }, 'Emitting a fake event');
  client.emit(emission.event as never, ...(emission.args as never[]));

  const given: Record<TargetOption | 'actor' | 'reason', unknown> = {
    channel: picked,
    author: options.getUser('author'),
    count: options.getInteger('count'),
    member: options.getUser('member'),
    role: options.getRole('role'),
    actor,
    reason,
  };
  const used = new Set<string>([...uses[scenario], ...(emission.audit ? ['actor', 'reason'] : [])]);
  const unused = Object.entries(given)
    .filter(([name, value]) => value != null && !used.has(name))
    .map(([name]) => `\`${tr(`dev.options.${name as TargetOption | 'actor' | 'reason'}.name`)}\``);

  const lines = [tr('dev.replies.emitted', { event: emission.event })];
  if (unused.length > 0) lines.push(tr('dev.replies.unused', { options: unused.join(', ') }));
  if (actor && emission.audit && !audit.canRead(guild))
    lines.push(tr('dev.replies.auditUnreadable'));
  const effect = sideEffects[scenario];
  if (effect) lines.push(tr(`dev.replies.sideEffects.${effect}`));
  return reply(lines.join('\n'));
}
