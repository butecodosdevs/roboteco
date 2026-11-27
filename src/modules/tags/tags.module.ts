import { inject, Module, type OnGuildRemove, type OnUserErase } from '@/core';
import { TagCommand } from './commands/tag/tag.command';
import { TagsService } from './tags.service';

@Module({ commands: [TagCommand] })
export class TagsModule implements OnGuildRemove, OnUserErase {
  private readonly tags = inject(TagsService);

  onGuildRemove(guildId: string) {
    return this.tags.purgeGuild(guildId);
  }

  onUserErase(userId: string, guildId?: string) {
    return this.tags.eraseUser(userId, guildId);
  }
}
