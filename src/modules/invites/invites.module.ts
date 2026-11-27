import { type Client, GatewayIntentBits } from 'discord.js';
import { inject, Module, type OnGuildRemove, type OnReady, type OnUserErase } from '@/core';
import { InvitesCommand } from './commands/invites/invites.command';
import { GuildMemberAddEvent } from './events/guild-member-add.event';
import { GuildMemberRemoveEvent } from './events/guild-member-remove.event';
import { InviteCreateEvent } from './events/invite-create.event';
import { InviteDeleteEvent } from './events/invite-delete.event';
import { InvitesService } from './invites.service';

@Module({
  intents: [GatewayIntentBits.GuildInvites, GatewayIntentBits.GuildMembers],
  commands: [InvitesCommand],
  events: [GuildMemberAddEvent, GuildMemberRemoveEvent, InviteCreateEvent, InviteDeleteEvent],
})
export class InvitesModule implements OnReady, OnGuildRemove, OnUserErase {
  private readonly invites = inject(InvitesService);

  async onReady(client: Client<true>) {
    for (const guild of client.guilds.cache.values()) await this.invites.snapshot(guild);
  }

  onGuildRemove(guildId: string) {
    return this.invites.purgeGuild(guildId);
  }

  onUserErase(userId: string, guildId?: string) {
    return this.invites.eraseUser(userId, guildId);
  }
}
