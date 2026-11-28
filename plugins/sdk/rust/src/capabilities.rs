//! Typed wrappers for every capability. Each one must be listed in the manifest's `uses`, and the
//! permission named in its module docs granted in `plugins/registry.json`.

use serde::{de::DeserializeOwned, Serialize};
use serde_json::{json, Value};

use crate::{call_capability, CallError, CallResult, Message};

fn field<T: DeserializeOwned>(mut out: Value, name: &str) -> CallResult<T> {
    serde_json::from_value(out[name].take()).map_err(|e| CallError { code: "sdk".into(), message: e.to_string() })
}

fn flag(out: Value, name: &str) -> CallResult<bool> {
    Ok(out[name] == true)
}

fn body_with(body: impl Into<Message>, extra: Value) -> Value {
    let mut input = serde_json::to_value(body.into()).unwrap_or_else(|_| json!({}));
    if let (Some(input), Value::Object(extra)) = (input.as_object_mut(), extra) {
        input.extend(extra.into_iter().filter(|(_, v)| !v.is_null()));
    }
    input
}

/// Writes an info line to the bot's logs (capability `log`, needs no permission).
pub fn log(message: impl Into<String>) {
    log_at("info", message);
}

/// Writes a warning to the bot's logs.
pub fn log_warn(message: impl Into<String>) {
    log_at("warn", message);
}

/// Writes an error to the bot's logs.
pub fn log_error(message: impl Into<String>) {
    log_at("error", message);
}

fn log_at(level: &str, message: impl Into<String>) {
    let _: CallResult<Value> = call_capability("log", json!({ "message": message.into(), "level": level }));
}

/// Key-value storage, one space per plugin and server (permission `kv`). Values are strings of up
/// to 4 KB, at most 1000 keys per server.
pub mod kv {
    use super::*;

    /// The value of `key`, or `None` when it is not set (`kv.get`).
    pub fn get(key: &str) -> CallResult<Option<String>> {
        field(call_capability("kv.get", json!({ "key": key }))?, "value")
    }

    /// Writes `value` to `key` (`kv.set`). Fails with `storage_full` past 1000 keys.
    pub fn set(key: &str, value: impl Into<String>) -> CallResult<()> {
        call_capability::<_, Value>("kv.set", json!({ "key": key, "value": value.into() }))?;
        Ok(())
    }

    /// Removes `key`; `true` when it existed (`kv.delete`).
    pub fn delete(key: &str) -> CallResult<bool> {
        flag(call_capability("kv.delete", json!({ "key": key }))?, "deleted")
    }

    /// Atomically adds `by` (missing keys start at 0) and returns the new value (`kv.increment`).
    pub fn increment(key: &str, by: i64) -> CallResult<i64> {
        let out: Value = call_capability("kv.increment", json!({ "key": key, "by": by }))?;
        Ok(out["value"].as_f64().unwrap_or(0.0) as i64)
    }

    /// Keys that start with `prefix`, sorted, at most 100 (`kv.list`).
    pub fn list(prefix: &str) -> CallResult<Vec<String>> {
        field(call_capability("kv.list", json!({ "prefix": prefix }))?, "keys")
    }

    /// Reads `key` as JSON. `None` when unset; an `sdk` error when it isn't valid JSON for `T`.
    pub fn get_json<T: DeserializeOwned>(key: &str) -> CallResult<Option<T>> {
        get(key)?
            .map(|raw| serde_json::from_str(&raw))
            .transpose()
            .map_err(|e| CallError { code: "sdk".into(), message: e.to_string() })
    }

    /// Writes `value` to `key` as JSON.
    pub fn set_json<T: Serialize>(key: &str, value: &T) -> CallResult<()> {
        let raw = serde_json::to_string(value).map_err(|e| CallError { code: "sdk".into(), message: e.to_string() })?;
        set(key, raw)
    }
}

/// Levels of this server (permission `levels.read`).
pub mod levels {
    use super::*;
    use crate::{LeaderboardEntry, Level};

    /// A member's XP, level and rank (`levels.get`).
    pub fn get(user_id: &str) -> CallResult<Level> {
        call_capability("levels.get", json!({ "userId": user_id }))
    }

    /// The top `limit` members (1 to 25) (`levels.top`).
    pub fn top(limit: u8) -> CallResult<Vec<LeaderboardEntry>> {
        field(call_capability("levels.top", json!({ "limit": limit.clamp(1, 25) }))?, "entries")
    }
}

/// XP grants (permission `xp.grant`). A plugin can give each member at most 100 XP every 10
/// minutes; past that, calls fail with `xp_limit`.
pub mod xp {
    use super::*;
    use crate::Grant;

    /// Gives XP (1 to 100) to the member who used the command, button or menu (`xp.grant`).
    /// Fails with `no_member` in events and jobs; use [`grant_to`] there.
    pub fn grant(amount: u8) -> CallResult<Grant> {
        call_capability("xp.grant", json!({ "amount": amount }))
    }

    /// Gives XP (1 to 100) to a member (`xp.grant`).
    pub fn grant_to(user_id: &str, amount: u8) -> CallResult<Grant> {
        call_capability("xp.grant", json!({ "userId": user_id, "amount": amount }))
    }
}

/// Discord data the plugin didn't get pushed (permission `discord.read`).
pub mod discord {
    use super::*;
    use crate::{Member, ServerRole};

    /// A member of this server, or `None` when they are not in it (`discord.member.get`).
    pub fn member(user_id: &str) -> CallResult<Option<Member>> {
        field(call_capability("discord.member.get", json!({ "userId": user_id }))?, "member")
    }

    /// This server's roles, highest first (`discord.roles.list`).
    pub fn roles() -> CallResult<Vec<ServerRole>> {
        field(call_capability("discord.roles.list", json!({}))?, "roles")
    }
}

/// Posting messages (permission `messages.send`; `remove` needs `messages.manage`). When a member
/// triggered the call, they must be able to do it themselves, or it fails with `caller_forbidden`.
pub mod messages {
    use super::*;
    use crate::Sent;

    /// Posts a message, in `channel_id` or, with `None`, where the command ran or the event
    /// happened (`discord.messages.send`). Buttons on it reach `handle_component`.
    pub fn send(channel_id: Option<&str>, body: impl Into<Message>) -> CallResult<Sent> {
        call_capability("discord.messages.send", body_with(body, json!({ "channelId": channel_id })))
    }

    /// Replaces a message this plugin posted, including public replies (`discord.messages.edit`).
    pub fn edit(channel_id: &str, message_id: &str, body: impl Into<Message>) -> CallResult<Sent> {
        let ids = json!({ "channelId": channel_id, "messageId": message_id });
        call_capability("discord.messages.edit", body_with(body, ids))
    }

    /// Deletes a message this plugin posted (`discord.messages.delete`).
    pub fn delete(channel_id: &str, message_id: &str) -> CallResult<bool> {
        let input = json!({ "channelId": channel_id, "messageId": message_id });
        flag(call_capability("discord.messages.delete", input)?, "deleted")
    }

    /// Deletes anyone's message, with a reason for the audit log (`discord.messages.remove`,
    /// permission `messages.manage`).
    pub fn remove(channel_id: &str, message_id: &str, reason: Option<&str>) -> CallResult<bool> {
        let input = json!({ "channelId": channel_id, "messageId": message_id, "reason": reason });
        flag(call_capability("discord.messages.remove", strip_nulls(input))?, "deleted")
    }
}

/// Reactions (permission `reactions`).
pub mod reactions {
    use super::*;

    /// Reacts to a message with a unicode emoji or a custom emoji ID (`discord.reactions.add`).
    pub fn add(channel_id: &str, message_id: &str, emoji: &str) -> CallResult<()> {
        let input = json!({ "channelId": channel_id, "messageId": message_id, "emoji": emoji });
        call_capability::<_, Value>("discord.reactions.add", input)?;
        Ok(())
    }
}

/// Direct messages (permission `dm.send`), 5 per member per hour (`dm_limit`).
pub mod dm {
    use super::*;

    /// DMs a member of this server; `false` when their DMs are closed (`discord.dm.send`).
    pub fn send(user_id: &str, body: impl Into<Message>) -> CallResult<bool> {
        flag(call_capability("discord.dm.send", body_with(body, json!({ "userId": user_id })))?, "delivered")
    }
}

/// Threads (permission `threads.create`).
pub mod threads {
    use super::*;

    /// Starts a thread in a text channel (`None`: where the command ran) and returns its ID
    /// (`discord.threads.create`).
    pub fn create(channel_id: Option<&str>, name: &str, private: bool) -> CallResult<String> {
        let input = json!({ "channelId": channel_id, "name": name, "private": private });
        field(call_capability("discord.threads.create", strip_nulls(input))?, "threadId")
    }

    /// Starts a thread on a message and returns its ID.
    pub fn from_message(channel_id: &str, message_id: &str, name: &str) -> CallResult<String> {
        let input = json!({ "channelId": channel_id, "messageId": message_id, "name": name });
        field(call_capability("discord.threads.create", input)?, "threadId")
    }
}

/// Giving and taking roles (permission `roles.manage`). Roles with staff permissions need a caller
/// with Manage Roles; managed roles and roles above the bot fail.
pub mod roles {
    use super::*;

    /// Gives a member a role; `false` when they already had it (`discord.roles.add`).
    pub fn add(user_id: &str, role_id: &str, reason: Option<&str>) -> CallResult<bool> {
        let input = json!({ "userId": user_id, "roleId": role_id, "reason": reason });
        flag(call_capability("discord.roles.add", strip_nulls(input))?, "changed")
    }

    /// Takes a role from a member; `false` when they didn't have it (`discord.roles.remove`).
    pub fn remove(user_id: &str, role_id: &str, reason: Option<&str>) -> CallResult<bool> {
        let input = json!({ "userId": user_id, "roleId": role_id, "reason": reason });
        flag(call_capability("discord.roles.remove", strip_nulls(input))?, "changed")
    }
}

/// Moderation. `history` needs `moderation.read`; the actions need `moderation.act`, open a case
/// like the built-in commands, and check that the member who triggered them could do it.
pub mod moderation {
    use super::*;
    use crate::{CaseOpened, History};

    fn act(name: &str, input: Value) -> CallResult<CaseOpened> {
        call_capability(name, strip_nulls(input))
    }

    /// A member's cases, newest first, up to `limit` (1 to 25) (`moderation.history`).
    pub fn history(user_id: &str, limit: u8) -> CallResult<History> {
        call_capability("moderation.history", json!({ "userId": user_id, "limit": limit.clamp(1, 25) }))
    }

    /// Warns a member; may escalate per the server's rules (`moderation.warn`).
    pub fn warn(user_id: &str, reason: &str) -> CallResult<CaseOpened> {
        act("moderation.warn", json!({ "userId": user_id, "reason": reason }))
    }

    /// Times a member out for 1 to 40320 minutes (28 days) (`moderation.timeout`).
    pub fn timeout(user_id: &str, minutes: u32, reason: Option<&str>) -> CallResult<CaseOpened> {
        act("moderation.timeout", json!({ "userId": user_id, "minutes": minutes, "reason": reason }))
    }

    /// Lifts a member's timeout (`moderation.untimeout`).
    pub fn untimeout(user_id: &str, reason: Option<&str>) -> CallResult<CaseOpened> {
        act("moderation.untimeout", json!({ "userId": user_id, "reason": reason }))
    }

    /// Kicks a member (`moderation.kick`).
    pub fn kick(user_id: &str, reason: Option<&str>) -> CallResult<CaseOpened> {
        act("moderation.kick", json!({ "userId": user_id, "reason": reason }))
    }

    /// Bans a user, deleting their last `delete_message_seconds` of messages (0 to 604800)
    /// (`moderation.ban`). For a temporary ban, schedule a job that calls [`unban`].
    pub fn ban(user_id: &str, reason: Option<&str>, delete_message_seconds: u32) -> CallResult<CaseOpened> {
        let input = json!({ "userId": user_id, "reason": reason, "deleteMessageSeconds": delete_message_seconds });
        act("moderation.ban", input)
    }

    /// Lifts a ban (`moderation.unban`).
    pub fn unban(user_id: &str, reason: Option<&str>) -> CallResult<CaseOpened> {
        act("moderation.unban", json!({ "userId": user_id, "reason": reason }))
    }
}

/// Running code later (permission `schedule`; the plugin must export `handle_job`). Runs are 10
/// seconds to a year ahead, at most 100 pending per server, data up to 2 KB.
pub mod schedule {
    use super::*;
    use crate::Run;

    /// A run of `handle_job` to create with [`create`].
    ///
    /// ```ignore
    /// schedule::create(Schedule::in_minutes(30).key(format!("remind:{}", cmd.user_id)).data(&reminder))?;
    /// ```
    #[derive(Debug, Clone)]
    pub struct Schedule {
        input: Value,
        error: Option<String>,
    }

    impl Schedule {
        /// `seconds` from now (10 to 31536000).
        pub fn in_seconds(seconds: u32) -> Self {
            Self { input: json!({ "seconds": seconds }), error: None }
        }
        /// `minutes` from now.
        pub fn in_minutes(minutes: u32) -> Self {
            Self::in_seconds(minutes.saturating_mul(60))
        }
        /// `hours` from now.
        pub fn in_hours(hours: u32) -> Self {
            Self::in_seconds(hours.saturating_mul(3600))
        }
        /// At an ISO 8601 time with an offset, e.g. `2026-12-25T09:00:00-03:00`.
        pub fn at(iso: impl Into<String>) -> Self {
            Self { input: json!({ "at": iso.into() }), error: None }
        }
        /// Names the run, so [`cancel`] can find it. A new run with the same key replaces the old.
        pub fn key(mut self, key: impl Into<String>) -> Self {
            self.input["key"] = Value::String(key.into());
            self
        }
        /// Data handed to `handle_job`; read it back with [`Job::data`](crate::Job::data).
        pub fn data<T: Serialize>(mut self, data: &T) -> Self {
            match serde_json::to_value(data) {
                Ok(value) => self.input["data"] = value,
                Err(e) => self.error = Some(e.to_string()),
            }
            self
        }
    }

    /// Schedules a run and returns when it will happen, ISO 8601 (`schedule.create`).
    pub fn create(run: Schedule) -> CallResult<String> {
        if let Some(message) = run.error {
            return Err(CallError { code: "sdk".into(), message });
        }
        field(call_capability("schedule.create", run.input)?, "runAt")
    }

    /// Cancels the pending run with `key`; `false` when there was none (`schedule.cancel`).
    pub fn cancel(key: &str) -> CallResult<bool> {
        flag(call_capability("schedule.cancel", json!({ "key": key }))?, "cancelled")
    }

    /// This plugin's pending runs in this server, soonest first (`schedule.list`).
    pub fn list() -> CallResult<Vec<Run>> {
        field(call_capability("schedule.list", json!({}))?, "runs")
    }
}

pub use schedule::Schedule;

fn strip_nulls(mut input: Value) -> Value {
    if let Some(map) = input.as_object_mut() {
        map.retain(|_, v| !v.is_null());
    }
    input
}
