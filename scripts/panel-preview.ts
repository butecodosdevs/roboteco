// Temporary harness: serves the panel with a client that is connected to no gateway.
import { Client, GatewayIntentBits } from 'discord.js';
import { startHttpServer } from '@/core/http';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const guild = {
  id: '1446642653826514996',
  name: 'bustedbeco',
  memberCount: 12,
  iconURL: () => null,
};
client.guilds.cache.set(guild.id, guild as never);
Object.assign(client, { user: { tag: 'roboteco#0001', displayAvatarURL: () => '' } });

startHttpServer(client, 4321, { panelToken: process.env.PANEL_TOKEN });
console.log('panel on http://127.0.0.1:4321');
setInterval(() => {}, 1 << 30);
