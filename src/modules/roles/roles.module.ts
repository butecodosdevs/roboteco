import { GatewayIntentBits, Partials } from 'discord.js';
import { inject, Module, type OnGuildRemove, type OnReady } from '@/core';
import { ReactionrolesCommand } from './commands/reactionroles/reactionroles.command';
import { RolesCommand } from './commands/roles/roles.command';
import { RolesSelect } from './components/roles.select';
import { MessageDeleteEvent } from './events/message-delete.event';
import { MessageReactionAddEvent } from './events/message-reaction-add.event';
import { MessageReactionRemoveEvent } from './events/message-reaction-remove.event';
import { ReactionRolesService } from './reaction-roles.service';
import { RolesService } from './roles.service';

@Module({
  intents: [GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions],
  partials: [Partials.Message, Partials.Reaction, Partials.User],
  commands: [RolesCommand, ReactionrolesCommand],
  components: [RolesSelect],
  events: [MessageReactionAddEvent, MessageReactionRemoveEvent, MessageDeleteEvent],
})
export class RolesModule implements OnReady, OnGuildRemove {
  private readonly roles = inject(RolesService);
  private readonly reactionRoles = inject(ReactionRolesService);

  onReady() {
    return this.reactionRoles.load();
  }

  async onGuildRemove(guildId: string) {
    await this.roles.purgeGuild(guildId);
    await this.reactionRoles.purgeGuild(guildId);
  }
}
