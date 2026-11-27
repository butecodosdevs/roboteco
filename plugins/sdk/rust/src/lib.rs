//! Write roboteco plugins in Rust.
//!
//! ```ignore
//! use extism_pdk::*;
//! use roboteco::*;
//!
//! #[plugin_fn]
//! pub fn manifest() -> FnResult<Json<Manifest>> {
//!     Ok(Json(Manifest::new("hello", "1.0.0").command(CommandSpec::new("hello", "Say hello"))))
//! }
//!
//! #[plugin_fn]
//! pub fn handle_command(Json(cmd): Json<Command>) -> FnResult<Json<Response>> {
//!     Ok(Json(Response::reply(format!("Hello, <@{}>!", cmd.user_id))))
//! }
//! ```

mod manifest;
mod types;

pub use manifest::*;
pub use types::*;

use extism_pdk::{host_fn, Error, Json};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::{json, Value};

#[host_fn]
extern "ExtismHost" {
    fn call(request: Json<Value>) -> Json<Value>;
}

/// An error the bot returned for a capability call: `code` is stable (`not_declared`,
/// `invalid_input`, `forbidden`, `rate_limited`, `storage_full`, `failed`, …).
#[derive(Debug)]
pub struct CallError {
    pub code: String,
    pub message: String,
}

impl std::fmt::Display for CallError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for CallError {}

/// Calls any capability by name. Prefer the typed wrappers in [`kv`], [`levels`], [`xp`] and [`discord`].
pub fn call_capability<I: Serialize, O: DeserializeOwned>(name: &str, input: I) -> Result<O, Error> {
    let Json(response) = unsafe { call(Json(json!({ "name": name, "input": input })))? };
    if response["ok"] == true {
        return Ok(serde_json::from_value(response["value"].clone())?);
    }
    Err(Error::new(CallError {
        code: response["error"]["code"].as_str().unwrap_or("failed").to_string(),
        message: response["error"]["message"].as_str().unwrap_or("call failed").to_string(),
    }))
}

/// Writes to the bot's logs.
pub fn log(message: impl Into<String>) {
    let _: Result<Value, _> = call_capability("log", json!({ "message": message.into() }));
}

/// Key-value storage, one space per plugin and server. Needs the `kv` permission and the
/// capabilities you use in the manifest's `uses`.
pub mod kv {
    use super::*;

    pub fn get(key: &str) -> Result<Option<String>, Error> {
        let out: Value = call_capability("kv.get", json!({ "key": key }))?;
        Ok(out["value"].as_str().map(str::to_string))
    }

    pub fn set(key: &str, value: impl Into<String>) -> Result<(), Error> {
        call_capability::<_, Value>("kv.set", json!({ "key": key, "value": value.into() }))?;
        Ok(())
    }

    pub fn delete(key: &str) -> Result<bool, Error> {
        let out: Value = call_capability("kv.delete", json!({ "key": key }))?;
        Ok(out["deleted"] == true)
    }

    /// Atomically adds `by` (missing keys start at 0) and returns the new value.
    pub fn increment(key: &str, by: i64) -> Result<i64, Error> {
        let out: Value = call_capability("kv.increment", json!({ "key": key, "by": by }))?;
        Ok(out["value"].as_i64().unwrap_or(0))
    }

    pub fn list(prefix: &str) -> Result<Vec<String>, Error> {
        let out: Value = call_capability("kv.list", json!({ "prefix": prefix }))?;
        Ok(serde_json::from_value(out["keys"].clone())?)
    }
}

/// Levels of this server (`levels.read`).
pub mod levels {
    use super::*;

    pub fn get(user_id: &str) -> Result<Level, Error> {
        call_capability("levels.get", json!({ "userId": user_id }))
    }

    pub fn top(limit: u8) -> Result<Vec<LeaderboardEntry>, Error> {
        let out: Value = call_capability("levels.top", json!({ "limit": limit }))?;
        Ok(serde_json::from_value(out["entries"].clone())?)
    }
}

/// XP grants for the member who ran the command (`xp.grant`).
pub mod xp {
    use super::*;

    pub fn grant(amount: u8) -> Result<Level, Error> {
        call_capability("xp.grant", json!({ "amount": amount }))
    }
}

/// Discord data the plugin didn't get pushed (`discord.read`).
pub mod discord {
    use super::*;

    pub fn member(user_id: &str) -> Result<Option<Member>, Error> {
        let out: Value = call_capability("discord.member.get", json!({ "userId": user_id }))?;
        Ok(serde_json::from_value(out["member"].clone())?)
    }
}

/// Moderation history of this server (`moderation.read`).
pub mod moderation {
    use super::*;

    pub fn history(user_id: &str, limit: u8) -> Result<History, Error> {
        call_capability("moderation.history", json!({ "userId": user_id, "limit": limit }))
    }
}
