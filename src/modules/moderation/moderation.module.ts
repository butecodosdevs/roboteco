import { inject, Module, type OnGuildRemove } from '@/core';
import { CasesService } from './cases.service';
import { BanCommand } from './commands/ban/ban.command';
import { CaseCommand } from './commands/case/case.command';
import { HistoryCommand } from './commands/history/history.command';
import { KickCommand } from './commands/kick/kick.command';
import { ModerationCommand } from './commands/moderation/moderation.command';
import { PurgeCommand } from './commands/purge/purge.command';
import { TimeoutCommand } from './commands/timeout/timeout.command';
import { UnbanCommand } from './commands/unban/unban.command';
import { UntimeoutCommand } from './commands/untimeout/untimeout.command';
import { WarnCommand } from './commands/warn/warn.command';
import { TimeoutModal } from './components/timeout.modal';
import { WarnModal } from './components/warn.modal';
import { TimeoutContextMenu } from './context-menus/timeout.context-menu';
import { WarnContextMenu } from './context-menus/warn.context-menu';
import { UnbanJob } from './jobs/unban.job';
import { TempBansService } from './temp-bans.service';

@Module({
  commands: [
    WarnCommand,
    TimeoutCommand,
    UntimeoutCommand,
    KickCommand,
    BanCommand,
    UnbanCommand,
    PurgeCommand,
    CaseCommand,
    HistoryCommand,
    ModerationCommand,
  ],
  contextMenus: [WarnContextMenu, TimeoutContextMenu],
  components: [WarnModal, TimeoutModal],
  jobs: [UnbanJob],
})
export class ModerationModule implements OnGuildRemove {
  private readonly cases = inject(CasesService);
  private readonly tempBans = inject(TempBansService);

  async onGuildRemove(guildId: string) {
    await this.tempBans.purgeGuild(guildId);
    await this.cases.purgeGuild(guildId);
  }
}
