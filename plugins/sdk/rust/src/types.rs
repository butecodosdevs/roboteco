use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// What `handle_command` and `autocomplete` receive.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Command {
    pub command: String,
    pub subcommand: Option<String>,
    #[serde(default)]
    pub options: HashMap<String, Value>,
    pub user_id: String,
    pub guild_id: String,
    pub channel_id: String,
    pub locale: String,
    #[serde(default)]
    pub context: Context,
    #[serde(default)]
    pub resolved: Resolved,
    /// Only set for `autocomplete`: the option being typed.
    pub focused: Option<Focused>,
}

impl Command {
    pub fn string(&self, name: &str) -> Option<&str> {
        self.options.get(name).and_then(Value::as_str)
    }
    pub fn integer(&self, name: &str) -> Option<i64> {
        self.options.get(name).and_then(Value::as_i64)
    }
    pub fn number(&self, name: &str) -> Option<f64> {
        self.options.get(name).and_then(Value::as_f64)
    }
    pub fn boolean(&self, name: &str) -> Option<bool> {
        self.options.get(name).and_then(Value::as_bool)
    }
    /// The ID of a `user`, `role` or `channel` option.
    pub fn id(&self, name: &str) -> Option<&str> {
        self.string(name)
    }
    /// The member picked in a `user` option, sent along by Discord (no extra call).
    pub fn member(&self, name: &str) -> Option<&Member> {
        self.string(name).and_then(|id| self.resolved.members.get(id))
    }
    pub fn role(&self, name: &str) -> Option<&Role> {
        self.string(name).and_then(|id| self.resolved.roles.get(id))
    }
    pub fn channel(&self, name: &str) -> Option<&Channel> {
        self.string(name).and_then(|id| self.resolved.channels.get(id))
    }
    pub fn is_portuguese(&self) -> bool {
        self.locale.starts_with("pt")
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct Context {
    /// The member who ran the command (manifest `context` includes "member").
    pub member: Option<Member>,
    pub guild: Option<Guild>,
    pub channel: Option<Channel>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct Resolved {
    #[serde(default)]
    pub members: HashMap<String, Member>,
    #[serde(default)]
    pub roles: HashMap<String, Role>,
    #[serde(default)]
    pub channels: HashMap<String, Channel>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Focused {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Member {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub avatar_url: String,
    pub bot: bool,
    pub owner: bool,
    pub roles: Vec<String>,
    pub joined_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Guild {
    pub id: String,
    pub name: String,
    pub member_count: u64,
    pub locale: String,
    pub icon_url: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Channel {
    pub id: String,
    pub name: Option<String>,
    #[serde(rename = "type")]
    pub kind: u8,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Role {
    pub id: String,
    pub name: String,
    pub color: u32,
    pub position: i32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Level {
    pub xp: u64,
    pub level: u64,
    /// Leaderboard position; absent from `xp::grant`, `None` when the member has no XP.
    #[serde(default)]
    pub rank: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardEntry {
    pub user_id: String,
    pub xp: u64,
    pub level: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct History {
    pub total: u64,
    pub cases: Vec<Case>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Case {
    pub number: u64,
    pub action: String,
    pub reason: Option<String>,
    pub moderator_id: String,
    pub duration_seconds: Option<u64>,
    pub created_at: String,
}

/// What `handle_command` returns.
#[derive(Debug, Clone, Default, Serialize)]
pub struct Response {
    actions: Vec<Value>,
}

impl Response {
    /// A reply everyone in the channel sees. Mentions never ping.
    pub fn reply(content: impl Into<String>) -> Self {
        Self::default().and_reply(content)
    }
    /// A reply only the member who ran the command sees.
    pub fn private(content: impl Into<String>) -> Self {
        Self::default().and_private(content)
    }
    pub fn and_reply(mut self, content: impl Into<String>) -> Self {
        self.actions.push(serde_json::json!({ "type": "reply", "content": content.into() }));
        self
    }
    pub fn and_private(mut self, content: impl Into<String>) -> Self {
        self.actions.push(serde_json::json!({ "type": "reply", "content": content.into(), "ephemeral": true }));
        self
    }
}

/// What `autocomplete` returns.
#[derive(Debug, Clone, Default, Serialize)]
pub struct Choices {
    choices: Vec<Value>,
}

impl Choices {
    pub fn from<S: Into<String> + Clone>(values: impl IntoIterator<Item = S>) -> Self {
        Self {
            choices: values
                .into_iter()
                .map(|v| {
                    let v: String = v.into();
                    serde_json::json!({ "name": v, "value": v })
                })
                .collect(),
        }
    }
    /// Keeps the values that start with what the member typed (case-insensitive), up to 25.
    pub fn matching<'a>(typed: &str, values: impl IntoIterator<Item = &'a str>) -> Self {
        let typed = typed.to_lowercase();
        Self::from(values.into_iter().filter(|v| v.to_lowercase().starts_with(&typed)).take(25))
    }
}
