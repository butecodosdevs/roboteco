import { Module } from '@/core';
import { PrivacyCommand } from './commands/privacy/privacy.command';
import { EraseButton } from './components/erase.button';

@Module({ commands: [PrivacyCommand], components: [EraseButton] })
export class PrivacyModule {}
