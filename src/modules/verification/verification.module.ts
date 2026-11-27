import { Module } from '@/core';
import { VerificationCommand } from './commands/verification/verification.command';
import { VerifyButton } from './components/verify.button';

@Module({ commands: [VerificationCommand], components: [VerifyButton] })
export class VerificationModule {}
