import { antiraidEnUS } from '@/modules/antiraid/i18n/en-US';
import { automodEnUS } from '@/modules/automod/i18n/en-US';
import { birthdaysEnUS } from '@/modules/birthdays/i18n/en-US';
import { countingEnUS } from '@/modules/counting/i18n/en-US';
import { customCommandsEnUS } from '@/modules/custom-commands/i18n/en-US';
import { devEnUS } from '@/modules/dev/i18n/en-US';
import { dropsEnUS } from '@/modules/drops/i18n/en-US';
import { embedsEnUS } from '@/modules/embeds/i18n/en-US';
import { feedsEnUS } from '@/modules/feeds/i18n/en-US';
import { giveawaysEnUS } from '@/modules/giveaways/i18n/en-US';
import { honeypotEnUS } from '@/modules/honeypot/i18n/en-US';
import { invitesEnUS } from '@/modules/invites/i18n/en-US';
import { levelsEnUS } from '@/modules/levels/i18n/en-US';
import { logsEnUS } from '@/modules/logs/i18n/en-US';
import { moderationEnUS } from '@/modules/moderation/i18n/en-US';
import { pingEnUS } from '@/modules/ping/i18n/en-US';
import { pluginsEnUS } from '@/modules/plugins/i18n/en-US';
import { privacyEnUS } from '@/modules/privacy/i18n/en-US';
import { remindersEnUS } from '@/modules/reminders/i18n/en-US';
import { reportsEnUS } from '@/modules/reports/i18n/en-US';
import { rolesEnUS } from '@/modules/roles/i18n/en-US';
import { safetyEnUS } from '@/modules/safety/i18n/en-US';
import { scheduledPostsEnUS } from '@/modules/scheduled-posts/i18n/en-US';
import { starboardEnUS } from '@/modules/starboard/i18n/en-US';
import { suggestionsEnUS } from '@/modules/suggestions/i18n/en-US';
import { tagsEnUS } from '@/modules/tags/i18n/en-US';
import { tempVoiceEnUS } from '@/modules/temp-voice/i18n/en-US';
import { ticketsEnUS } from '@/modules/tickets/i18n/en-US';
import { verificationEnUS } from '@/modules/verification/i18n/en-US';
import { welcomeEnUS } from '@/modules/welcome/i18n/en-US';

// `name` keys are the canonical command/option identifiers that handlers match on.
export const enUS = {
  errors: {
    missingPermission: 'You need {permissions} to use this.',
    commandFailed: 'Something went wrong running that command.',
    guildOnly: 'This command only works inside a server.',
    cooldown: 'Slow down. You can use this again {when}.',
    componentExpired: 'This control no longer works. Run the command again.',
    commandDisabled:
      'This command is turned off. An administrator can turn it back on in the panel.',
  },
  ping: pingEnUS,
  honeypot: honeypotEnUS,
  moderation: moderationEnUS,
  tags: tagsEnUS,
  suggestions: suggestionsEnUS,
  roles: rolesEnUS,
  reports: reportsEnUS,
  tickets: ticketsEnUS,
  levels: levelsEnUS,
  starboard: starboardEnUS,
  welcome: welcomeEnUS,
  logs: logsEnUS,
  dev: devEnUS,
  reminders: remindersEnUS,
  privacy: privacyEnUS,
  drops: dropsEnUS,
  tempVoice: tempVoiceEnUS,
  plugins: pluginsEnUS,
  verification: verificationEnUS,
  antiraid: antiraidEnUS,
  giveaways: giveawaysEnUS,
  scheduledPosts: scheduledPostsEnUS,
  birthdays: birthdaysEnUS,
  feeds: feedsEnUS,
  customCommands: customCommandsEnUS,
  counting: countingEnUS,
  invites: invitesEnUS,
  automod: automodEnUS,
  embeds: embedsEnUS,
  safety: safetyEnUS,
} as const;
