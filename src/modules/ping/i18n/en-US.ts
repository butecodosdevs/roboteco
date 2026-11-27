export const pingEnUS = {
  command: { name: 'ping', description: 'Check if the bot is alive' },
  pending: 'Pinging…',
  result: 'Pong! Roundtrip: {roundtrip}ms · WebSocket: {ws}ms',
} as const;
