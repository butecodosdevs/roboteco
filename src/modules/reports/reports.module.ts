import { inject, Module, type OnGuildRemove, type OnUserErase } from '@/core';
import { ReportsCommand } from './commands/reports/reports.command';
import { ReportModal } from './components/report.modal';
import { ReportActionButton } from './components/report-action.button';
import { ReportMessageContextMenu } from './context-menus/report-message.context-menu';
import { ReportUserContextMenu } from './context-menus/report-user.context-menu';
import { ReportsService } from './reports.service';

@Module({
  commands: [ReportsCommand],
  contextMenus: [ReportMessageContextMenu, ReportUserContextMenu],
  components: [ReportModal, ReportActionButton],
})
export class ReportsModule implements OnGuildRemove, OnUserErase {
  private readonly reports = inject(ReportsService);

  onGuildRemove(guildId: string) {
    return this.reports.purgeGuild(guildId);
  }

  onUserErase(userId: string, guildId?: string) {
    return this.reports.eraseUser(userId, guildId);
  }
}
