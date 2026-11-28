//! What capabilities return.

use serde::Deserialize;

/// A member's standing, from [`levels::get`](crate::levels::get).
#[derive(Debug, Clone, Deserialize)]
pub struct Level {
    pub xp: u64,
    pub level: u64,
    /// Leaderboard position; `None` when the member has no XP.
    #[serde(default)]
    pub rank: Option<u64>,
}

/// The result of [`xp::grant`](crate::xp::grant).
#[derive(Debug, Clone, Deserialize)]
pub struct Grant {
    /// The member's total XP after the grant.
    pub xp: u64,
    pub level: u64,
    /// How much more XP this plugin can give this member right now.
    pub remaining: u64,
}

/// A row of [`levels::top`](crate::levels::top).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardEntry {
    pub user_id: String,
    pub xp: u64,
    pub level: u64,
}

/// A member's cases, from [`moderation::history`](crate::moderation::history).
#[derive(Debug, Clone, Deserialize)]
pub struct History {
    /// All cases, not only the ones returned.
    pub total: u64,
    /// Newest first.
    pub cases: Vec<Case>,
}

/// A moderation case.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Case {
    pub number: u64,
    /// e.g. `warn`, `timeout`, `kick`, `ban`.
    pub action: String,
    pub reason: Option<String>,
    pub moderator_id: String,
    pub duration_seconds: Option<u64>,
    /// ISO 8601.
    pub created_at: String,
}

/// What a moderation action did.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaseOpened {
    /// The case number.
    pub case: u64,
    /// Whether the member got a DM about it.
    pub notified: bool,
    /// When a warning crossed the server's threshold: the case of the automatic punishment.
    pub escalated_case: Option<u64>,
}

/// A message the plugin posted or edited.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sent {
    pub message_id: String,
    pub channel_id: String,
}

/// A role of the server, from [`discord::roles`](crate::discord::roles).
#[derive(Debug, Clone, Deserialize)]
pub struct ServerRole {
    pub id: String,
    pub name: String,
    pub color: u32,
    pub position: i32,
    /// Owned by an integration (a bot or boosts); can't be given or taken.
    pub managed: bool,
    /// Grants staff permissions; giving or taking it needs a caller with Manage Roles.
    pub elevated: bool,
}

/// A pending run, from [`schedule::list`](crate::schedule::list).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Run {
    pub key: Option<String>,
    /// ISO 8601.
    pub run_at: String,
}
