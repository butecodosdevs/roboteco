import { inject, Module, type OnGuildRemove, type OnUserErase } from '@/core';
import { SuggestCommand } from './commands/suggest/suggest.command';
import { SuggestionsCommand } from './commands/suggestions/suggestions.command';
import { VoteButton } from './components/vote.button';
import { SuggestionsService } from './suggestions.service';

@Module({ commands: [SuggestCommand, SuggestionsCommand], components: [VoteButton] })
export class SuggestionsModule implements OnGuildRemove, OnUserErase {
  private readonly suggestions = inject(SuggestionsService);

  onGuildRemove(guildId: string) {
    return this.suggestions.purgeGuild(guildId);
  }

  onUserErase(userId: string, guildId?: string) {
    return this.suggestions.eraseUser(userId, guildId);
  }
}
