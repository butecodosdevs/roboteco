import { applySettingsToEnv } from './core/settings';

// The Configurações tab writes overrides to panel/settings.json, and they must land in
// `process.env` before anything imports ./config (which parses it at module load). Every import
// below is therefore dynamic: a static one would be hoisted above this call.
applySettingsToEnv();

const { bootstrap } = await import('@/core');
const { AppModule } = await import('./app.module');
const { config } = await import('./config');

await bootstrap(AppModule, {
  token: config.token,
  privilegedIntents: config.privilegedIntents,
  healthPort: config.healthPort,
  panelToken: config.panelToken,
});
