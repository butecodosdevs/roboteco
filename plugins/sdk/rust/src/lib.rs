//! Write roboteco plugins in Rust.
//!
//! A plugin is a WASM module with a few exports. `manifest` says what it adds to Discord, the
//! `handle_*` exports answer, and the typed wrappers ([`kv`], [`levels`], [`messages`], …) call the
//! bot. Each capability you call must be listed in the manifest's [`Manifest::uses`].
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
//!     Ok(Json(Response::reply(
//!         Message::text(format!("Hello, <@{}>!", cmd.user_id)).buttons([Button::primary("wave", "Wave back")]),
//!     )))
//! }
//!
//! #[plugin_fn]
//! pub fn handle_component(Json(click): Json<Command>) -> FnResult<Json<Response>> {
//!     Ok(Json(Response::update(format!("<@{}> waved back.", click.user_id))))
//! }
//! ```
//!
//! Exports the bot calls:
//!
//! | export             | input       | returns      | when                                       |
//! |--------------------|-------------|--------------|--------------------------------------------|
//! | `manifest`         | nothing     | [`Manifest`] | once, at load                              |
//! | `handle_command`   | [`Command`] | [`Response`] | slash commands and context menus           |
//! | `autocomplete`     | [`Command`] | [`Choices`]  | a member types in an autocomplete option   |
//! | `handle_component` | [`Command`] | [`Response`] | button clicks, select picks, form submits  |
//! | `handle_event`     | [`Event`]   | [`Done`]     | events listed in [`Manifest::events`]      |
//! | `handle_job`       | [`Job`]     | [`Done`]     | runs created with [`schedule::create`]     |

mod capabilities;
mod event;
mod input;
mod manifest;
mod response;
mod types;

pub use capabilities::*;
pub use event::*;
pub use input::*;
pub use manifest::*;
pub use response::*;
pub use types::*;

use extism_pdk::Json;
use serde::{de::DeserializeOwned, Serialize};
use serde_json::{json, Value};

#[cfg(target_arch = "wasm32")]
#[extism_pdk::host_fn]
extern "ExtismHost" {
    fn call(request: Json<Value>) -> Json<Value>;
}

// Off WASM there is no bot to call; this lets builders and parsers be unit tested natively.
#[cfg(not(target_arch = "wasm32"))]
unsafe fn call(_request: Json<Value>) -> Result<Json<Value>, extism_pdk::Error> {
    Ok(Json(json!({ "ok": false, "error": { "code": "no_host", "message": "not running inside the bot" } })))
}

/// An error from a capability call.
///
/// `code` is stable, so match on it: `not_declared`, `invalid_input`, `caller_forbidden`,
/// `bot_forbidden`, `rate_limited`, `xp_limit`, `storage_full`, `not_found`, `no_server`, …
/// Errors made by the SDK itself (the bot was unreachable, or answered in an unexpected shape)
/// use the code `sdk`.
///
/// ```ignore
/// match xp::grant(50) {
///     Err(e) if e.is("xp_limit") => Response::private("No more XP for now."),
///     other => Response::reply(format!("Now {} XP", other?.xp)),
/// }
/// ```
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CallError {
    /// Stable, machine-readable reason, e.g. `xp_limit`.
    pub code: String,
    /// Human-readable detail. Don't match on it; it may change.
    pub message: String,
}

impl CallError {
    /// Whether this error has the given `code`.
    pub fn is(&self, code: &str) -> bool {
        self.code == code
    }

    fn sdk(message: impl std::fmt::Display) -> Self {
        Self { code: "sdk".into(), message: message.to_string() }
    }
}

impl std::fmt::Display for CallError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for CallError {}

/// What every capability wrapper returns. `?` turns the error into an [`extism_pdk::Error`].
pub type CallResult<T> = Result<T, CallError>;

/// Calls any capability by name with raw JSON. Prefer the typed wrappers ([`kv`], [`levels`], …).
pub fn call_capability<I: Serialize, O: DeserializeOwned>(name: &str, input: I) -> CallResult<O> {
    let request = json!({ "name": name, "input": input });
    let Json(response) = unsafe { call(Json(request)) }.map_err(CallError::sdk)?;
    if response["ok"] == true {
        return serde_json::from_value(response["value"].clone()).map_err(CallError::sdk);
    }
    Err(CallError {
        code: response["error"]["code"].as_str().unwrap_or("failed").to_string(),
        message: response["error"]["message"].as_str().unwrap_or("call failed").to_string(),
    })
}

/// What `handle_event` and `handle_job` return: an empty object.
#[derive(Debug, Clone, Copy, Default)]
pub struct Done;

impl Serialize for Done {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        serializer.serialize_map(Some(0))?.end()
    }
}

#[cfg(test)]
mod tests;
