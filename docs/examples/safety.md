# Example: the safety module

Code: `src/modules/safety/`.

## What it does

The bot checks the links and files in every message against threat databases. It deletes a message only when one of them **confirms** a threat. Anything unknown, or a check that failed, leaves the message up. Nothing is blocked just because of its type: an `.exe` or a link from an unfamiliar site stays up unless a source says it is malicious.

| Command | Effect |
| --- | --- |
| `/safety toggle enabled` | Turns scanning on or off for the server (off by default) |
| `/safety timeout minutes` | Also times out the author for that long, 0 for none (the default) |
| `/safety status` | Shows the settings, which checks this bot has, whether ClamAV answers, and missing permissions |

When something is found, the bot:
- deletes the message, with the reason in the audit log;
- posts the author, the channel and each finding (links defanged, `hxxps://evil[.]com`) to the moderation log channel;
- times out the author, if `/safety timeout` is set. Members with Manage Server, bots and webhooks are never timed out. The timeout is recorded as a moderation case;
- posts a notice in the channel that mentions the author and names the sources that confirmed the threat. It pings only the author and doesn't repeat the link;
- DMs the author the details, when moderation DMs are on (`/moderation dm`).

Bots and webhooks get no notice, DM or timeout.

The bot needs the Message Content intent (`DISCORD_PRIVILEGED_INTENTS=true`) and Manage Messages, plus Moderate Members for timeouts.

## Sources

Every source is optional and turned on by its environment variable (`.env.example`). `/safety status` lists what is active.

| Source | Checks | Counts as a threat | Setting |
| --- | --- | --- | --- |
| Phishing domain list | link domains, and their parent domains | domain is on the list | `PHISHING_LIST_URLS` (default: Discord-AntiScam's list) |
| Google Safe Browsing | links | any match (malware, phishing, unwanted software, harmful app) | `SAFE_BROWSING_API_KEY` |
| URLhaus | links | listed and not offline | `ABUSECH_AUTH_KEY` |
| MalwareBazaar | file SHA-256 | known sample | `ABUSECH_AUTH_KEY` |
| VirusTotal | links and file SHA-256 | at least `VIRUSTOTAL_MIN_DETECTIONS` engines (3) say malicious | `VIRUSTOTAL_API_KEY` |
| ClamAV | file contents | a signature match | `CLAMAV_HOST` |

Rules that keep false positives out:
- ClamAV `Heuristics.*` and `PUA.*` results are ignored, because they guess from a file's shape instead of matching known malware.
- A list entry for a whole shared platform (`vercel.app`, `github.io`, `pages.dev`…) is ignored; entries for one subdomain on it still count.
- Files are never uploaded anywhere. VirusTotal and MalwareBazaar only get the hash, and ClamAV runs next to the bot.

## How it works

```
safety/
  safety.service.ts          the flow: scan a message, then remove it or schedule its recheck
  scan.service.ts            a message's links and files -> findings
  threats.service.ts         Threat, Verdict, the ThreatCheck contract, and the remembered verdicts
  removal.service.ts         delete, time out, report to the moderation log, DM the author
  rechecks.service.ts        the queue of later rechecks
  phishing-list.service.ts   ThreatCheck for links
  safe-browsing.service.ts   ThreatCheck for links
  abuse-ch.service.ts        URLhaus (links) and MalwareBazaar (files)
  virus-total.service.ts     links and files, within the request budget
  clamav.service.ts          ThreatCheck for files, over src/lib/clamd.ts
```

Every source implements one contract, `ThreatCheck<S>`: `confirm(subject)` returns the source's detail for a confirmed threat, null when it knows nothing bad, and throws when it can't answer. `ThreatsService.verdict` asks the enabled checks in order and stops at the first threat. The result is a `Verdict`:
- a `Threat`;
- `clean`, when every check answered;
- `unknown`, when one couldn't answer. Unknown never deletes anything.

1. `MessageCreate` and `MessageUpdate` (when the text changed) call `SafetyService.process`. Forwarded messages are scanned too.
2. `contentsOf` takes the links from the text and embeds (`findLinks`, `src/lib/links.ts`) and the attachments, at most 10 of each.
3. Each link's redirects are followed with `HEAD` requests through `resolveRedirects` (`src/lib/safe-fetch.ts`, which refuses private addresses), and every hop gets a verdict.
4. Attachments up to `SAFETY_MAX_FILE_MB` (25) are downloaded into memory, at most 3 at a time (`Limiter`, `src/lib/limiter.ts`), and hashed.
5. Checks run from cheapest to most limited. VirusTotal's free API allows about 4 requests a minute, so it is last. Its budget is counted in Valkey (`VIRUSTOTAL_REQUESTS_PER_MINUTE`, `VIRUSTOTAL_REQUESTS_PER_DAY`); once spent, its answer is unknown.
6. Verdicts are remembered in Valkey by URL or file hash: threats for 7 days, clean for 30 minutes. Unknown is not remembered.
7. On a threat, `safety:acted:<messageId>` is set with `NX`, so a create, an edit and a recheck of the same message act once.

`src/lib/clamd.ts` holds the clamd protocol, apart from the policy: the `z` command form, INSTREAM's length-prefixed frames, and the reply grammar. `ClamavService` decides that `Heuristics.*` and `PUA.*` signatures don't count.

**Rechecks.** Databases often list new malware hours after it starts spreading. A message that comes back clean is queued in the Valkey sorted set `safety:rechecks` to be checked again after 1 hour and after 24 hours, and a recheck ignores remembered clean verdicts. `RecheckJob` runs every 5 minutes, claims due entries with `ZREM` (`RechecksService.takeDue`) and rescans each message that still exists.

**Phishing lists** are kept in memory. They are downloaded on start, then every hour by `RefreshPhishingListsJob` (every 5 minutes until a first download works). If every download fails, the previous list is kept.

**Data.** Settings are two columns on `guilds` (`safety_enabled`, `safety_timeout_minutes`, migration `drizzle/0014_safety.sql`). The module stores no user data. `onGuildRemove` drops the server's pending rechecks.

## Running ClamAV

ClamAV is in both compose files behind the `clamav` profile, because it needs about 1.5 GB of RAM:

```sh
COMPOSE_PROFILES=clamav pnpm services:up   # locally; then CLAMAV_HOST=localhost
```

In production, set `COMPOSE_PROFILES=clamav` and `CLAMAV_HOST=clamav` in `.env`. The first start downloads the signatures, which takes a few minutes; `freshclam` keeps them current after that.

## Tests

`tests/safety/safety.test.ts` (`pnpm test`) runs against the real Postgres and Valkey, with Discord faked and the phishing list loaded from text:
- a listed domain's subdomain is deleted and reported defanged; a whole shared platform on the list flags nothing, a listed site on it does;
- clean content stays up and is queued for the 1 h recheck; the 24 h recheck deletes a link listed since, and nothing is queued after it;
- scanning off does nothing; three racing scans of one message act once;
- a configured timeout is applied and recorded with its length, except for members with Manage Server;
- the author is told in the channel, pinged alone and without the link; a bot's message gets no notice;
- a check that can't answer gives an unknown verdict that isn't remembered; a recheck ignores remembered clean verdicts but not threats;
- with `CLAMAV_HOST` set, an EICAR attachment is deleted and a harmless one stays.

## Limits

- No check catches everything. A brand-new file or site is in no database yet; rechecks narrow that window but don't close it.
- Attachments over `SAFETY_MAX_FILE_MB` are not downloaded, so they are not checked.
- QR codes in images are not decoded yet.
