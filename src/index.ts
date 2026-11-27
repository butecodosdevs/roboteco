import { bootstrap } from '@/core';
import { AppModule } from './app.module';
import { config } from './config';

await bootstrap(AppModule, {
  token: config.token,
  privilegedIntents: config.privilegedIntents,
  healthPort: config.healthPort,
});
