# Scheduled jobs

## What it is

A job is work that runs at a set time, possibly days later. A class decorated with `@Job(name)` does the work, and `schedule(JobClass, runAt, payload)` queues a run. Runs are stored in the `scheduled_jobs` table, so they survive restarts.

## What it's for

Anything time-based: reminders, temporary bans, expiring warnings, scheduled announcements. A `setTimeout` is lost when the bot restarts. A job isn't.

## How it works

- Files go in `jobs/<name>.job.ts`, with the class named `*Job` and listed in the module's `jobs`.
- `execute(payload, client)` receives the JSON payload passed to `schedule`. `schedule` checks that the payload's type matches `execute`.
- `schedule(...)` returns the job ID. Keep it so you can call `cancelJob(id)` later.
- Use a stable string for `@Job('<module>.<action>')`. Queued rows refer to it, so renaming it orphans them.
- **The runner** starts after login and checks every 10 seconds:
  - It claims up to 20 due jobs with `FOR UPDATE SKIP LOCKED`, and moves their run time forward 5 minutes. If the bot crashes during a run, the job therefore runs again later instead of being lost.
  - When `execute` succeeds, the job is deleted.
  - When it fails, it is retried after 2, 4, 8 and then 16 minutes, and deleted after the 5th failed attempt.
- **Make jobs idempotent.** A crash can make a job run twice. Read the current state from the database first and do nothing if it's already done; a reminder that was cancelled simply returns.
- Keep payloads small (IDs, not whole objects), and load fresh data in `execute`.

## Recurring jobs

A job that repeats (feed polling, the daily birthday run) schedules its next run first, then does the work inside `try`/`catch`. Because it never throws, a failure never makes the runner retry it on top of the next scheduled run. The module's `onReady` calls `ensureScheduled(Job, runAt, payload)`, which queues the first run only if none is pending:

```ts
onReady() {
  return ensureScheduled(PollFeedsJob, new Date(Date.now() + pollIntervalMs), {});
}
```

## Example: reminders

**`src/modules/reminders/jobs/reminder.job.ts`** (shortened):

```ts
export interface ReminderPayload {
  reminderId: number;
}

@Job('reminders.deliver')
export class ReminderJob {
  async execute({ reminderId }: ReminderPayload, client: Client<true>) {
    const reminders = inject(RemindersService);
    const reminder = await reminders.get(reminderId);
    if (!reminder) return;
    // post in the original channel, or DM the user
    await reminders.complete(reminder.id);
  }
}
```

Scheduling it from `/remind`:

```ts
const reminder = await this.reminders.create({ userId, guildId, channelId, text, remindAt });
await this.reminders.setJob(reminder.id, await schedule(ReminderJob, remindAt, { reminderId: reminder.id }));
```

The job calls `inject` inside `execute` instead of in a field. That's because the service also imports the job file, and calling `inject` at run time avoids depending on which file loads first.
