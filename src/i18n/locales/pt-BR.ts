import { antiraidPtBR } from '@/modules/antiraid/i18n/pt-BR';
import { automodPtBR } from '@/modules/automod/i18n/pt-BR';
import { birthdaysPtBR } from '@/modules/birthdays/i18n/pt-BR';
import { countingPtBR } from '@/modules/counting/i18n/pt-BR';
import { customCommandsPtBR } from '@/modules/custom-commands/i18n/pt-BR';
import { dropsPtBR } from '@/modules/drops/i18n/pt-BR';
import { feedsPtBR } from '@/modules/feeds/i18n/pt-BR';
import { giveawaysPtBR } from '@/modules/giveaways/i18n/pt-BR';
import { honeypotPtBR } from '@/modules/honeypot/i18n/pt-BR';
import { invitesPtBR } from '@/modules/invites/i18n/pt-BR';
import { levelsPtBR } from '@/modules/levels/i18n/pt-BR';
import { logsPtBR } from '@/modules/logs/i18n/pt-BR';
import { moderationPtBR } from '@/modules/moderation/i18n/pt-BR';
import { pingPtBR } from '@/modules/ping/i18n/pt-BR';
import { pluginsPtBR } from '@/modules/plugins/i18n/pt-BR';
import { privacyPtBR } from '@/modules/privacy/i18n/pt-BR';
import { remindersPtBR } from '@/modules/reminders/i18n/pt-BR';
import { reportsPtBR } from '@/modules/reports/i18n/pt-BR';
import { rolesPtBR } from '@/modules/roles/i18n/pt-BR';
import { scheduledPostsPtBR } from '@/modules/scheduled-posts/i18n/pt-BR';
import { starboardPtBR } from '@/modules/starboard/i18n/pt-BR';
import { suggestionsPtBR } from '@/modules/suggestions/i18n/pt-BR';
import { tagsPtBR } from '@/modules/tags/i18n/pt-BR';
import { tempVoicePtBR } from '@/modules/temp-voice/i18n/pt-BR';
import { ticketsPtBR } from '@/modules/tickets/i18n/pt-BR';
import { verificationPtBR } from '@/modules/verification/i18n/pt-BR';
import { welcomePtBR } from '@/modules/welcome/i18n/pt-BR';
import type { Messages } from '../types';

export const ptBR: Messages = {
  errors: {
    commandFailed: 'Algo deu errado ao executar esse comando.',
    guildOnly: 'Este comando só funciona dentro de um servidor.',
    cooldown: 'Calma. Você poderá usar isto de novo {when}.',
    componentExpired: 'Este controle não funciona mais. Execute o comando de novo.',
  },
  ping: pingPtBR,
  honeypot: honeypotPtBR,
  moderation: moderationPtBR,
  tags: tagsPtBR,
  suggestions: suggestionsPtBR,
  roles: rolesPtBR,
  reports: reportsPtBR,
  tickets: ticketsPtBR,
  levels: levelsPtBR,
  starboard: starboardPtBR,
  welcome: welcomePtBR,
  logs: logsPtBR,
  reminders: remindersPtBR,
  privacy: privacyPtBR,
  drops: dropsPtBR,
  tempVoice: tempVoicePtBR,
  plugins: pluginsPtBR,
  verification: verificationPtBR,
  antiraid: antiraidPtBR,
  giveaways: giveawaysPtBR,
  scheduledPosts: scheduledPostsPtBR,
  birthdays: birthdaysPtBR,
  feeds: feedsPtBR,
  customCommands: customCommandsPtBR,
  counting: countingPtBR,
  invites: invitesPtBR,
  automod: automodPtBR,
};
