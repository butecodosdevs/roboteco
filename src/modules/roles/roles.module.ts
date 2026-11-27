import { inject, Module, type OnGuildRemove } from '@/core';
import { RolesCommand } from './commands/roles/roles.command';
import { RolesSelect } from './components/roles.select';
import { RolesService } from './roles.service';

@Module({ commands: [RolesCommand], components: [RolesSelect] })
export class RolesModule implements OnGuildRemove {
  private readonly roles = inject(RolesService);

  onGuildRemove(guildId: string) {
    return this.roles.purgeGuild(guildId);
  }
}
