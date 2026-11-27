import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { emojiKey, ReactionRolesService } from '../reaction-roles.service';
import { RolesService } from '../roles.service';

@On(Events.MessageReactionRemove)
export class MessageReactionRemoveEvent {
  private readonly reactionRoles = inject(ReactionRolesService);
  private readonly roles = inject(RolesService);

  async execute(...[reaction, user]: ClientEvents[Events.MessageReactionRemove]) {
    if (user.bot) return;
    const roleId = this.reactionRoles.roleFor(reaction.message.id, emojiKey(reaction.emoji));
    const guild = reaction.message.guild;
    if (!roleId || !guild) return;
    const role = guild.roles.cache.get(roleId);
    if (!role || !this.roles.canAssign(guild, role)) return;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member?.roles.cache.has(roleId)) return;
    await member.roles.remove(roleId, 'Reaction role');
  }
}
