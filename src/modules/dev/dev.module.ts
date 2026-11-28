import { Module } from '@/core';
import { DevCommand } from './commands/dev/dev.command';

/** Tools for testing the bot by hand. `AppModule` only loads it when NODE_ENV is development. */
@Module({ commands: [DevCommand] })
export class DevModule {}
