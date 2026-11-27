import { inject, Module, type OnGuildRemove, type OnUserErase } from '@/core';
import { TicketsCommand } from './commands/tickets/tickets.command';
import { CloseTicketButton } from './components/close-ticket.button';
import { OpenTicketButton } from './components/open-ticket.button';
import { TicketsService } from './tickets.service';

@Module({ commands: [TicketsCommand], components: [OpenTicketButton, CloseTicketButton] })
export class TicketsModule implements OnGuildRemove, OnUserErase {
  private readonly tickets = inject(TicketsService);

  onGuildRemove(guildId: string) {
    return this.tickets.purgeGuild(guildId);
  }

  onUserErase(userId: string, guildId?: string) {
    return this.tickets.eraseUser(userId, guildId);
  }
}
