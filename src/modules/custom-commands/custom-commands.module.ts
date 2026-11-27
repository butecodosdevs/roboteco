import { inject, Module, type OnGuildRemove } from '@/core';
import { CustomcommandCommand } from './commands/customcommand/customcommand.command';
import { CustomCommandsService } from './custom-commands.service';
import { InteractionCreateEvent } from './events/interaction-create.event';

@Module({ commands: [CustomcommandCommand], events: [InteractionCreateEvent] })
export class CustomCommandsModule implements OnGuildRemove {
  private readonly commands = inject(CustomCommandsService);

  onGuildRemove(guildId: string) {
    return this.commands.purgeGuild(guildId);
  }
}
