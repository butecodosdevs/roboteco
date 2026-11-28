import { config } from '@/config';
import { Module } from '@/core';
import { AntiraidModule } from '@/modules/antiraid/antiraid.module';
import { AutomodModule } from '@/modules/automod/automod.module';
import { BirthdaysModule } from '@/modules/birthdays/birthdays.module';
import { CountingModule } from '@/modules/counting/counting.module';
import { CustomCommandsModule } from '@/modules/custom-commands/custom-commands.module';
import { DevModule } from '@/modules/dev/dev.module';
import { DomainEventsModule } from '@/modules/domain-events/domain-events.module';
import { DropsModule } from '@/modules/drops/drops.module';
import { EmbedsModule } from '@/modules/embeds/embeds.module';
import { FeedsModule } from '@/modules/feeds/feeds.module';
import { GiveawaysModule } from '@/modules/giveaways/giveaways.module';
import { GuildsModule } from '@/modules/guilds/guilds.module';
import { HoneypotModule } from '@/modules/honeypot/honeypot.module';
import { InvitesModule } from '@/modules/invites/invites.module';
import { LevelsModule } from '@/modules/levels/levels.module';
import { LogsModule } from '@/modules/logs/logs.module';
import { ModerationModule } from '@/modules/moderation/moderation.module';
import { PanelModule } from '@/modules/panel/panel.module';
import { PingModule } from '@/modules/ping/ping.module';
import { PluginsModule } from '@/modules/plugins/plugins.module';
import { PrivacyModule } from '@/modules/privacy/privacy.module';
import { RemindersModule } from '@/modules/reminders/reminders.module';
import { ReportsModule } from '@/modules/reports/reports.module';
import { RolesModule } from '@/modules/roles/roles.module';
import { SafetyModule } from '@/modules/safety/safety.module';
import { ScheduledPostsModule } from '@/modules/scheduled-posts/scheduled-posts.module';
import { StarboardModule } from '@/modules/starboard/starboard.module';
import { SuggestionsModule } from '@/modules/suggestions/suggestions.module';
import { TagsModule } from '@/modules/tags/tags.module';
import { TempVoiceModule } from '@/modules/temp-voice/temp-voice.module';
import { TicketsModule } from '@/modules/tickets/tickets.module';
import { VerificationModule } from '@/modules/verification/verification.module';
import { WelcomeModule } from '@/modules/welcome/welcome.module';

@Module({
  imports: [
    DomainEventsModule,
    GuildsModule,
    PingModule,
    ModerationModule,
    HoneypotModule,
    TagsModule,
    SuggestionsModule,
    RolesModule,
    ReportsModule,
    TicketsModule,
    LevelsModule,
    StarboardModule,
    WelcomeModule,
    LogsModule,
    RemindersModule,
    PrivacyModule,
    DropsModule,
    TempVoiceModule,
    PluginsModule,
    VerificationModule,
    AntiraidModule,
    GiveawaysModule,
    ScheduledPostsModule,
    BirthdaysModule,
    FeedsModule,
    CustomCommandsModule,
    CountingModule,
    InvitesModule,
    AutomodModule,
    EmbedsModule,
    PanelModule,
    SafetyModule,
    ...(config.env === 'development' ? [DevModule] : []),
  ],
})
export class AppModule {}
