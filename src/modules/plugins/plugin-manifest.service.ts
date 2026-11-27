import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  InteractionContextType,
  Locale,
  PermissionFlagsBits,
  PermissionsBitField,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import { z } from 'zod';
import { Injectable } from '@/core';
import { channelSchema, contextKinds, guildSchema, memberSchema } from './discord-data.service';

const name = z
  .string()
  .regex(/^[-_\p{L}\p{N}]{1,32}$/u, 'lowercase letters, numbers, - or _, up to 32')
  .refine((value) => value === value.toLowerCase(), 'must be lowercase');
const description = z.string().min(1).max(100);
const localizations = <T extends z.ZodType>(value: T) =>
  z.partialRecord(z.enum(Object.values(Locale) as [Locale, ...Locale[]]), value).optional();

const optionTypes = {
  string: ApplicationCommandOptionType.String,
  integer: ApplicationCommandOptionType.Integer,
  number: ApplicationCommandOptionType.Number,
  boolean: ApplicationCommandOptionType.Boolean,
  user: ApplicationCommandOptionType.User,
  channel: ApplicationCommandOptionType.Channel,
  role: ApplicationCommandOptionType.Role,
} as const;

const option = z
  .object({
    type: z.enum(
      Object.keys(optionTypes) as [keyof typeof optionTypes, ...(keyof typeof optionTypes)[]],
    ),
    name,
    description,
    nameLocalizations: localizations(name),
    descriptionLocalizations: localizations(description),
    required: z.boolean().optional(),
    choices: z
      .array(z.object({ name: description, value: z.union([z.string().max(100), z.number()]) }))
      .max(25)
      .optional(),
    autocomplete: z.boolean().optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    minLength: z.number().int().min(0).max(6000).optional(),
    maxLength: z.number().int().min(1).max(6000).optional(),
  })
  .refine((o) => !(o.choices && o.autocomplete), 'choices and autocomplete are exclusive');

const optionList = z
  .array(option)
  .max(25)
  .refine(
    (options) =>
      options.every((o, i) => !o.required || options.slice(0, i).every((p) => p.required)),
    'required options must come before optional ones',
  )
  .optional();

const subcommand = z.object({
  name,
  description,
  nameLocalizations: localizations(name),
  descriptionLocalizations: localizations(description),
  options: optionList,
});

const permissionName = z.enum(
  Object.keys(PermissionFlagsBits) as [
    keyof typeof PermissionFlagsBits,
    ...(keyof typeof PermissionFlagsBits)[],
  ],
);

export const commandSchema = z
  .object({
    name,
    description,
    nameLocalizations: localizations(name),
    descriptionLocalizations: localizations(description),
    options: optionList,
    subcommands: z.array(subcommand).max(25).optional(),
    defaultMemberPermissions: z.array(permissionName).optional(),
    guildOnly: z.boolean().default(true),
  })
  .refine(
    (c) => !(c.options?.length && c.subcommands?.length),
    'a command has options or subcommands, not both',
  );

export const manifestSchema = z.object({
  name: z.string().min(1).max(32),
  version: z.string().max(32),
  commands: z.array(commandSchema).max(25),
  uses: z.array(z.string().max(64)).max(50).default([]),
  context: z.array(z.enum(contextKinds)).default([]),
});

const optionValue = z.union([z.string(), z.number(), z.boolean()]);
const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.number(),
  position: z.number(),
});

/** What `handle_command` and `autocomplete` receive. */
export const commandInputSchema = z.object({
  command: z.string(),
  subcommand: z.string().nullable(),
  options: z.record(z.string(), optionValue),
  userId: z.string(),
  guildId: z.string(),
  channelId: z.string(),
  locale: z.string(),
  context: z
    .object({
      member: memberSchema.optional(),
      guild: guildSchema.optional(),
      channel: channelSchema.optional(),
    })
    .optional(),
  resolved: z
    .object({
      members: z.record(z.string(), memberSchema),
      roles: z.record(z.string(), roleSchema),
      channels: z.record(z.string(), channelSchema),
    })
    .optional(),
  focused: z.object({ name: z.string(), value: z.string() }).optional(),
});

/** What `handle_command` returns. */
export const commandOutputSchema = z.object({
  actions: z
    .array(
      z.discriminatedUnion('type', [
        z.object({
          type: z.literal('reply'),
          content: z.string().min(1).max(2000),
          ephemeral: z.boolean().optional(),
        }),
      ]),
    )
    .max(5),
});

/** What `autocomplete` returns. */
export const choicesSchema = z.object({
  choices: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        value: z.union([z.string().max(100), z.number()]),
      }),
    )
    .max(25),
});

export type CommandInput = z.infer<typeof commandInputSchema>;
export type PluginAction = z.infer<typeof commandOutputSchema>['actions'][number];
export type PluginChoice = z.infer<typeof choicesSchema>['choices'][number];
export type PluginCommandSpec = z.infer<typeof commandSchema>;
export type PluginManifest = z.infer<typeof manifestSchema>;
type OptionSpec = z.infer<typeof option>;

function optionJSON(spec: OptionSpec) {
  return {
    type: optionTypes[spec.type],
    name: spec.name,
    description: spec.description,
    name_localizations: spec.nameLocalizations,
    description_localizations: spec.descriptionLocalizations,
    required: spec.required ?? false,
    ...(spec.choices && { choices: spec.choices }),
    ...(spec.autocomplete && { autocomplete: true }),
    ...(spec.minValue !== undefined && { min_value: spec.minValue }),
    ...(spec.maxValue !== undefined && { max_value: spec.maxValue }),
    ...(spec.minLength !== undefined && { min_length: spec.minLength }),
    ...(spec.maxLength !== undefined && { max_length: spec.maxLength }),
  };
}

@Injectable()
export class PluginManifestService {
  parse(raw: unknown): PluginManifest {
    return manifestSchema.parse(raw);
  }

  toCommandJSON(spec: PluginCommandSpec): RESTPostAPIChatInputApplicationCommandsJSONBody {
    const options = spec.subcommands?.length
      ? spec.subcommands.map((sub) => ({
          type: ApplicationCommandOptionType.Subcommand,
          name: sub.name,
          description: sub.description,
          name_localizations: sub.nameLocalizations,
          description_localizations: sub.descriptionLocalizations,
          options: (sub.options ?? []).map(optionJSON),
        }))
      : (spec.options ?? []).map(optionJSON);
    return {
      type: ApplicationCommandType.ChatInput,
      name: spec.name,
      description: spec.description,
      name_localizations: spec.nameLocalizations,
      description_localizations: spec.descriptionLocalizations,
      options,
      ...(spec.defaultMemberPermissions && {
        default_member_permissions: new PermissionsBitField(
          spec.defaultMemberPermissions,
        ).bitfield.toString(),
      }),
      ...(spec.guildOnly && { contexts: [InteractionContextType.Guild] }),
    } as RESTPostAPIChatInputApplicationCommandsJSONBody;
  }
}
