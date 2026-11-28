import {
  ActionRowBuilder,
  type BaseMessageOptions,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  EmbedBuilder,
  LabelBuilder,
  type MessageActionRowComponentBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} from 'discord.js';
import { Injectable } from '@/core';
import type { MessageBody, PluginAction } from './plugin-manifest.service';

/** Custom ids of plugin components start with this; the core router leaves them to plugins. */
export const pluginComponentPrefix = 'plg';

const buttonStyles = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
  link: ButtonStyle.Link,
} as const;

type ModalAction = Extract<PluginAction, { type: 'modal' }>;
type Row = NonNullable<MessageBody['components']>[number];

/** Turns plugin JSON into discord.js payloads, namespacing every component id by plugin. */
@Injectable()
export class PluginRenderService {
  customId(pluginId: string, id: string): string {
    return `${pluginComponentPrefix}:${pluginId}:${id}`;
  }

  /** The plugin and its own id for a custom id this service made, or null. */
  parseCustomId(customId: string): { pluginId: string; id: string } | null {
    const match = /^plg:([a-z0-9-]{1,32}):(.+)$/.exec(customId);
    return match?.[1] && match[2] ? { pluginId: match[1], id: match[2] } : null;
  }

  message(pluginId: string, body: MessageBody): BaseMessageOptions {
    return {
      content: body.content ?? '',
      embeds: (body.embeds ?? []).map((e) => {
        const embed = new EmbedBuilder();
        if (e.title) embed.setTitle(e.title);
        if (e.description) embed.setDescription(e.description);
        if (e.url) embed.setURL(e.url);
        if (e.color !== undefined) embed.setColor(e.color);
        if (e.fields) embed.addFields(e.fields);
        if (e.author) embed.setAuthor({ name: e.author.name, iconURL: e.author.iconUrl });
        if (e.footer) embed.setFooter({ text: e.footer.text, iconURL: e.footer.iconUrl });
        if (e.image) embed.setImage(e.image);
        if (e.thumbnail) embed.setThumbnail(e.thumbnail);
        if (e.timestamp) embed.setTimestamp(new Date(e.timestamp));
        return embed;
      }),
      components: (body.components ?? []).map((row) => this.row(pluginId, row)),
      // The bot posts plugin text on members' behalf; it never pings anyone.
      allowedMentions: { parse: [] },
    };
  }

  modal(pluginId: string, modal: ModalAction): ModalBuilder {
    return new ModalBuilder()
      .setCustomId(this.customId(pluginId, modal.id))
      .setTitle(modal.title)
      .addLabelComponents(
        ...modal.fields.map((field) => {
          const input = new TextInputBuilder()
            .setCustomId(field.id)
            .setStyle(field.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setRequired(field.required);
          if (field.placeholder) input.setPlaceholder(field.placeholder);
          if (field.value) input.setValue(field.value);
          if (field.minLength !== undefined) input.setMinLength(field.minLength);
          if (field.maxLength !== undefined) input.setMaxLength(field.maxLength);
          return new LabelBuilder().setLabel(field.label).setTextInputComponent(input);
        }),
      );
  }

  private row(pluginId: string, row: Row): ActionRowBuilder<MessageActionRowComponentBuilder> {
    const components = row.map((c): MessageActionRowComponentBuilder => {
      if (c.type === 'button') {
        const button = new ButtonBuilder().setStyle(buttonStyles[c.style]);
        if (c.label) button.setLabel(c.label);
        if (c.emoji) button.setEmoji(c.emoji);
        if (c.disabled) button.setDisabled(true);
        if (c.url) button.setURL(c.url);
        else if (c.id) button.setCustomId(this.customId(pluginId, c.id));
        return button;
      }
      const id = this.customId(pluginId, c.id);
      const menu =
        c.menu === 'user'
          ? new UserSelectMenuBuilder()
          : c.menu === 'role'
            ? new RoleSelectMenuBuilder()
            : c.menu === 'channel'
              ? new ChannelSelectMenuBuilder()
              : new StringSelectMenuBuilder().addOptions(
                  (c.options ?? []).map((o) => ({
                    label: o.label,
                    value: o.value,
                    description: o.description,
                    emoji: o.emoji,
                    default: o.default,
                  })),
                );
      menu.setCustomId(id);
      if (c.placeholder) menu.setPlaceholder(c.placeholder);
      if (c.min !== undefined) menu.setMinValues(c.min);
      if (c.max !== undefined) menu.setMaxValues(c.max);
      if (c.disabled) menu.setDisabled(true);
      return menu;
    });
    return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(components);
  }
}
