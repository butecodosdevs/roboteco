import { Module } from '@/core';
import { PingCommand } from './commands/ping/ping.command';

@Module({ commands: [PingCommand] })
export class PingModule {}
