import {
  type AutoModerationActionOptions,
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  type Guild,
} from 'discord.js';
import { Injectable } from '@/core';
import { getGuildSettings } from '@/db';
import { t } from '@/i18n';

export type Preset = 'invites' | 'links' | 'keywords' | 'mentions' | 'spam';

export interface PresetOptions {
  words?: string[];
  limit?: number;
  timeoutMinutes?: number;
}

export type CreateResult = 'created' | 'exists' | 'limitReached';

const triggers: Record<Preset, AutoModerationRuleTriggerType> = {
  invites: AutoModerationRuleTriggerType.Keyword,
  links: AutoModerationRuleTriggerType.Keyword,
  keywords: AutoModerationRuleTriggerType.Keyword,
  mentions: AutoModerationRuleTriggerType.MentionSpam,
  spam: AutoModerationRuleTriggerType.Spam,
};

const inviteRegex = '(?i)(discord\\.gg|discord(app)?\\.com/invite)/[a-z0-9-]+';
const linkRegex = 'https?://\\S+';

@Injectable()
export class AutomodService {
  async create(guild: Guild, preset: Preset, options: PresetOptions = {}): Promise<CreateResult> {
    const locale = guild.preferredLocale;
    const name = t(locale, `automod.ruleNames.${preset}`);
    const existing = await guild.autoModerationRules.fetch();
    if (existing.some((rule) => rule.name === name)) return 'exists';

    const logChannelId = (await getGuildSettings(guild.id))?.moderationLogChannelId;
    const actions: AutoModerationActionOptions[] = [
      {
        type: AutoModerationActionType.BlockMessage,
        metadata: { customMessage: t(locale, 'automod.blockMessage') },
      },
    ];
    if (logChannelId)
      actions.push({
        type: AutoModerationActionType.SendAlertMessage,
        metadata: { channel: logChannelId },
      });
    if (options.timeoutMinutes && (preset === 'keywords' || preset === 'mentions')) {
      actions.push({
        type: AutoModerationActionType.Timeout,
        metadata: { durationSeconds: options.timeoutMinutes * 60 },
      });
    }

    const triggerMetadata =
      preset === 'invites'
        ? { regexPatterns: [inviteRegex] }
        : preset === 'links'
          ? { regexPatterns: [linkRegex] }
          : preset === 'keywords'
            ? { keywordFilter: options.words ?? [] }
            : preset === 'mentions'
              ? { mentionTotalLimit: options.limit ?? 5, mentionRaidProtectionEnabled: true }
              : {};

    try {
      await guild.autoModerationRules.create({
        name,
        eventType: AutoModerationRuleEventType.MessageSend,
        triggerType: triggers[preset],
        triggerMetadata,
        actions,
        enabled: true,
        reason: 'Created with /automod',
      });
      return 'created';
    } catch (error) {
      if (error instanceof Error && /maximum|limit/i.test(error.message)) return 'limitReached';
      throw error;
    }
  }
}
