import { Module } from '@/core';
import { AutomodCommand } from './commands/automod/automod.command';

@Module({ commands: [AutomodCommand] })
export class AutomodModule {}
