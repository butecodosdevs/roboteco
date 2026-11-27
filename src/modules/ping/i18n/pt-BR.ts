import type { Messages } from '@/i18n/types';

export const pingPtBR: Messages['ping'] = {
  command: { name: 'ping', description: 'Verifica se o bot está online' },
  pending: 'Pingando…',
  result: 'Pong! Ida e volta: {roundtrip}ms · WebSocket: {ws}ms',
};
