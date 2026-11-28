import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import {
  Collection,
  ComponentType,
  MessageFlags,
  PermissionFlagsBits,
  PermissionsBitField,
} from 'discord.js';
import { eq } from 'drizzle-orm';
import '@/app.module';
import { closeCache } from '@/cache';
import { inject } from '@/core';
import { isDelegatedComponent } from '@/core/component';
import { closeDb, db, schema } from '@/db';
import { InteractionCreateEvent } from '@/modules/plugins/events/interaction-create.event';
import { RunPluginJob } from '@/modules/plugins/jobs/run-plugin.job';
import { PluginEngineService } from '@/modules/plugins/plugin-engine.service';
import { PluginEventsService } from '@/modules/plugins/plugin-events.service';
import { PluginHostService } from '@/modules/plugins/plugin-host.service';
import { PluginRegistryService } from '@/modules/plugins/plugin-registry.service';
import { uniqueGuildId } from './fakes';

// Built by `pnpm plugins:build` from plugins/fixtures/contract-rust.
const wasm = 'plugins/dist/contract.wasm';
const guildId = uniqueGuildId();
const listener = new InteractionCreateEvent();
let ids = 0;

type Call = [string, any];

/** A stand-in interaction with only the fields the listener reads. */
function interaction(
  kind: 'command' | 'userMenu' | 'button' | 'select' | 'modal',
  fields: Record<string, unknown>,
) {
  const calls: Call[] = [];
  const self: any = {
    calls,
    id: String(++ids),
    user: { id: '200000000000000700' },
    guildId,
    channelId: '400000000000000700',
    locale: 'en-US',
    memberPermissions: new PermissionsBitField([PermissionFlagsBits.SendMessages]),
    replied: false,
    deferred: false,
    inGuild: () => true,
    inCachedGuild: () => false,
    isAutocomplete: () => false,
    isChatInputCommand: () => kind === 'command',
    isUserContextMenuCommand: () => kind === 'userMenu',
    isMessageContextMenuCommand: () => false,
    isMessageComponent: () => kind === 'button' || kind === 'select',
    isModalSubmit: () => kind === 'modal',
    isFromMessage: () => false,
    isButton: () => kind === 'button',
    isAnySelectMenu: () => kind === 'select',
    isUserSelectMenu: () => false,
    isMentionableSelectMenu: () => false,
    isRoleSelectMenu: () => false,
    isChannelSelectMenu: () => false,
    options: { data: [] },
    reply: async (p: any) => {
      calls.push(['reply', p]);
      self.replied = true;
      return {
        resource: {
          message: { id: `5000000000000${ids}${calls.length}`, channelId: self.channelId },
        },
      };
    },
    deferReply: async () => {
      calls.push(['deferReply', null]);
      self.deferred = true;
    },
    deferUpdate: async () => {
      calls.push(['deferUpdate', null]);
      self.deferred = true;
    },
    editReply: async (p: any) => {
      calls.push(['editReply', p]);
      self.replied = true;
      return { id: `5100000000000${ids}`, channelId: self.channelId };
    },
    followUp: async (p: any) => {
      calls.push(['followUp', p]);
      return { id: `5200000000000${ids}`, channelId: self.channelId };
    },
    deleteReply: async () => calls.push(['deleteReply', null]),
    update: async (p: any) => {
      calls.push(['update', p]);
      self.replied = true;
    },
    showModal: async (m: any) => calls.push(['showModal', m]),
    ...fields,
  };
  return self;
}

const json = (payload: any) => JSON.parse(JSON.stringify(payload));
const customIds = (payload: any): string[] =>
  json(payload).components.flatMap((row: any) => row.components.map((c: any) => c.custom_id));

before(async () => {
  if (!existsSync(wasm)) throw new Error(`${wasm} is missing: run pnpm plugins:build first`);
  const plugin = await inject(PluginEngineService).load({
    id: 'contract',
    wasm,
    permissions: ['kv', 'events.members', 'intents.GuildMessages'],
  });
  inject(PluginRegistryService).add(plugin);
});

after(async () => {
  await inject(PluginHostService).purgeGuild(guildId);
  await inject(PluginRegistryService).unloadAll();
  await closeDb();
  await closeCache();
});

test('a plugin command answers with an embed and namespaced components, and the reply is recorded', async () => {
  const i = interaction('command', { commandName: 'panel' });
  await listener.execute(i);
  const [[kind, payload]] = i.calls;
  assert.equal(kind, 'reply');
  assert.equal(json(payload).embeds[0].description, 'count: 0');
  assert.deepEqual(customIds(payload), ['plg:contract:inc', 'plg:contract:pick']);
  assert.deepEqual(payload.allowedMentions, { parse: [] });
  const rows = await db
    .select()
    .from(schema.pluginMessages)
    .where(eq(schema.pluginMessages.guildId, guildId));
  assert.deepEqual(
    rows.map((r) => r.pluginId),
    ['contract'],
  );
});

test('the core router leaves plugin components to the plugins', () => {
  assert.equal(isDelegatedComponent('plg:contract:inc'), true);
  assert.equal(isDelegatedComponent('tickets:close'), false);
});

test('a button click reaches the plugin and updates the message it is on', async () => {
  for (const expected of ['count: 1', 'count: 2']) {
    const click = interaction('button', {
      customId: 'plg:contract:inc',
      message: { id: '600000000000000001' },
    });
    await listener.execute(click);
    const [[kind, payload]] = click.calls;
    assert.equal(kind, 'update');
    assert.equal(json(payload).embeds[0].description, expected);
  }
});

test('a click the plugin answers with nothing is just acknowledged', async () => {
  const click = interaction('button', {
    customId: 'plg:contract:noop',
    message: { id: '600000000000000001' },
  });
  await listener.execute(click);
  assert.deepEqual(
    click.calls.map(([kind]: Call) => kind),
    ['deferUpdate'],
  );
});

test('select values reach the plugin, and a private reply stays private', async () => {
  const pick = interaction('select', {
    customId: 'plg:contract:pick',
    values: ['red', 'blue'],
    message: { id: '600000000000000001' },
  });
  await listener.execute(pick);
  const [[kind, payload]] = pick.calls;
  assert.equal(kind, 'reply');
  assert.equal(payload.content, 'picked red,blue');
  assert.equal(payload.flags, MessageFlags.Ephemeral);
});

test('a command opens a form, and its submit reaches the plugin with the typed fields', async () => {
  const open = interaction('command', { commandName: 'form' });
  await listener.execute(open);
  const [[kind, modal]] = open.calls;
  assert.equal(kind, 'showModal');
  assert.equal(modal.data.custom_id, 'plg:contract:feedback');

  const submit = interaction('modal', {
    customId: 'plg:contract:feedback',
    fields: {
      fields: new Collection([
        ['text', { type: ComponentType.TextInput, customId: 'text', value: 'love it' }],
      ]),
    },
  });
  await listener.execute(submit);
  assert.equal(submit.calls[0]?.[1].content, 'thanks: love it');
});

test("a command's default permissions are enforced before the plugin runs", async () => {
  const member = interaction('command', { commandName: 'staff' });
  await listener.execute(member);
  const [[, refused]] = member.calls;
  assert.notEqual(refused.content, 'staff only');
  assert.equal(refused.flags, MessageFlags.Ephemeral);
  assert.match(refused.content, /BanMembers/);

  const staff = interaction('command', {
    commandName: 'staff',
    user: { id: '200000000000000701' },
    memberPermissions: new PermissionsBitField([PermissionFlagsBits.BanMembers]),
  });
  await listener.execute(staff);
  assert.equal(staff.calls[0]?.[1].content, 'staff only');
});

test('a user context menu gets the right-clicked member', async () => {
  const menu = interaction('userMenu', {
    commandName: 'Inspect',
    targetId: '200000000000000777',
    targetMember: null,
  });
  await listener.execute(menu);
  assert.equal(menu.calls[0]?.[1].content, 'inspected 200000000000000777');
});

test('a command queued behind a stuck one is acknowledged in time, then answered', async () => {
  const stuck = interaction('command', { commandName: 'spin' });
  const queued = interaction('command', {
    commandName: 'panel',
    user: { id: '200000000000000702' },
  });
  await Promise.all([listener.execute(stuck), listener.execute(queued)]);
  assert.deepEqual(
    queued.calls.map(([kind]: Call) => kind),
    ['deferReply', 'editReply'],
  );
  assert.equal(json(queued.calls[1]?.[1]).embeds[0].title, 'Panel');
  // The stuck one was acknowledged too, then told it timed out instead of being left hanging.
  assert.deepEqual(
    stuck.calls.map(([kind]: Call) => kind),
    ['deferReply', 'editReply'],
  );
});

test('a component from an uninstalled plugin is answered, not left to time out', async () => {
  const ghost = interaction('button', {
    customId: 'plg:ghost:inc',
    message: { id: '600000000000000002' },
  });
  await listener.execute(ghost);
  assert.equal(ghost.calls[0]?.[0], 'reply');
  assert.equal(ghost.calls[0]?.[1].flags, MessageFlags.Ephemeral);
});

const stored = async (key: string) =>
  (
    await inject(PluginHostService).get(
      { pluginId: 'contract', guildId, channelId: null, caller: null },
      { key },
    )
  ).value;

test('a scheduled run reaches handle_job with its key and data', async () => {
  await new RunPluginJob().execute({
    pluginId: 'contract',
    guildId,
    channelId: null,
    key: 'remind:1',
    data: { text: 'stretch' },
  });
  assert.equal(await stored('job:remind:1'), JSON.stringify({ text: 'stretch' }));
});

test('events reach subscribers, and a backlog behind a stuck call is capped at 20', async () => {
  const events = inject(PluginEventsService);
  const join = () =>
    events.dispatch('memberJoin', guildId, null, {
      member: {
        id: '200000000000000800',
        username: 'new',
        displayName: 'New',
        avatarUrl: '',
        bot: false,
        owner: false,
        roles: [],
        joinedAt: null,
      },
    });
  await join();
  assert.equal(await stored('joins'), '1');

  // A stuck command holds the plugin (queued first, synchronously); 25 joins arrive meanwhile
  // and only 20 may wait.
  const plugin = inject(PluginRegistryService).get('contract');
  assert.ok(plugin);
  const stuck = inject(PluginEngineService)
    .interact(
      plugin,
      {
        kind: 'command',
        command: 'spin',
        subcommand: null,
        options: {},
        userId: '200000000000000700',
        guildId,
        channelId: '400000000000000700',
        locale: 'en-US',
        permissions: [],
      },
      null,
    )
    .catch(() => undefined);
  await Promise.all([stuck, ...Array.from({ length: 25 }, join)]);
  assert.equal(await stored('joins'), '21');
});
