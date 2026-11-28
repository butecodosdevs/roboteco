import { config } from '@/config';
import { Injectable } from '@/core';
import { pingClamd, scanWithClamd } from '@/lib/clamd';
import type { ScannedFile, ThreatCheck } from './threats.service';

// Heuristic and "potentially unwanted" detections guess from a file's shape instead of matching
// known malware, so they don't count as a confirmed threat.
const unconfirmedSignatures = /^(Heuristics|PUA)\./;

/** ClamAV, through the clamd daemon at CLAMAV_HOST. */
@Injectable()
export class ClamavService implements ThreatCheck<ScannedFile> {
  readonly source = 'clamav';
  readonly enabled = config.safety.clamav !== undefined;

  /** The name of the known-malware signature the file matches. */
  async confirm(file: ScannedFile): Promise<string | null> {
    if (!config.safety.clamav) return null;
    const result = await scanWithClamd(config.safety.clamav, file.bytes);

    if (!result.infected || unconfirmedSignatures.test(result.signature)) return null;
    return result.signature;
  }

  /** Whether clamd is configured and answering. */
  async isUp(): Promise<boolean> {
    return config.safety.clamav !== undefined && pingClamd(config.safety.clamav);
  }
}
