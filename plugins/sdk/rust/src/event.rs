use serde::{de::DeserializeOwned, Deserialize, Deserializer};
use serde_json::Value;

use crate::{Member, MessageData};

/// What `handle_event` receives, for the events listed in [`Manifest::events`](crate::Manifest::events).
///
/// ```ignore
/// #[plugin_fn]
/// pub fn handle_event(Json(event): Json<Event>) -> FnResult<Json<Done>> {
///     if let EventData::MemberJoin(join) = &event.data {
///         messages::send(None, format!("Welcome, <@{}>!", join.member.id))?;
///     }
///     Ok(Json(Done))
/// }
/// ```
#[derive(Debug, Clone)]
pub struct Event {
    /// The event name, e.g. `messageCreate`.
    pub event: String,
    pub guild_id: String,
    /// Where it happened, when it happened in a channel. `messages::send(None, ..)` posts there.
    pub channel_id: Option<String>,
    /// The event's data, typed.
    pub data: EventData,
}

/// The data of an [`Event`], one variant per event name.
#[derive(Debug, Clone)]
pub enum EventData {
    /// `messageCreate` (permission `events.messages`).
    MessageCreate(MessageCreate),
    /// `memberJoin` (permission `events.members`).
    MemberJoin(MemberJoin),
    /// `memberLeave` (permission `events.members`).
    MemberLeave(MemberLeave),
    /// `reactionAdd` (permission `events.reactions`).
    ReactionAdd(ReactionAdd),
    /// `levelUp` (permission `events.levels`).
    LevelUp(LevelUp),
    /// `caseCreated` (permission `events.moderation`).
    CaseCreated(CaseCreated),
    /// A Discord gateway event from [`Manifest::discord_events`](crate::Manifest::discord_events),
    /// with Discord's own JSON. See [`Event::decode`].
    Discord(Value),
    /// An event this SDK doesn't know yet, with its raw data.
    Other(Value),
}

impl Event {
    /// Reads a Discord event's (or unknown event's) data into your own type, following Discord's
    /// docs: <https://discord.com/developers/docs/events/gateway-events>.
    pub fn decode<T: DeserializeOwned>(&self) -> Result<T, serde_json::Error> {
        match &self.data {
            EventData::Discord(value) | EventData::Other(value) => T::deserialize(value),
            _ => Err(serde::de::Error::custom("not a Discord event; match on EventData instead")),
        }
    }
}

/// Someone posted a message.
#[derive(Debug, Clone, Deserialize)]
pub struct MessageCreate {
    pub message: MessageData,
    /// The author, when they are a member of the server.
    pub member: Option<Member>,
}

/// Someone joined the server.
#[derive(Debug, Clone, Deserialize)]
pub struct MemberJoin {
    pub member: Member,
}

/// Someone left the server (or was kicked or banned).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemberLeave {
    pub user_id: String,
    pub username: String,
    /// The role IDs they had.
    pub roles: Vec<String>,
}

/// Someone reacted to a message.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReactionAdd {
    pub message_id: String,
    pub channel_id: String,
    pub user_id: String,
    /// A unicode emoji, or a custom emoji's ID.
    pub emoji: String,
}

/// A member reached a new level.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LevelUp {
    pub user_id: String,
    pub level: u64,
    pub xp: u64,
}

/// A moderation case was opened (warn, timeout, kick, ban, …).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaseCreated {
    pub number: u64,
    /// e.g. `warn`, `timeout`, `kick`, `ban`.
    pub action: String,
    pub target_id: String,
    pub moderator_id: String,
    pub reason: Option<String>,
    pub duration_seconds: Option<u64>,
}

impl<'de> Deserialize<'de> for Event {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Raw {
            event: String,
            guild_id: String,
            channel_id: Option<String>,
            #[serde(default)]
            data: Value,
        }
        fn parse<T: DeserializeOwned, E: serde::de::Error>(data: Value) -> Result<T, E> {
            serde_json::from_value(data).map_err(E::custom)
        }
        let raw = Raw::deserialize(deserializer)?;
        let data = match raw.event.as_str() {
            "messageCreate" => EventData::MessageCreate(parse(raw.data)?),
            "memberJoin" => EventData::MemberJoin(parse(raw.data)?),
            "memberLeave" => EventData::MemberLeave(parse(raw.data)?),
            "reactionAdd" => EventData::ReactionAdd(parse(raw.data)?),
            "levelUp" => EventData::LevelUp(parse(raw.data)?),
            "caseCreated" => EventData::CaseCreated(parse(raw.data)?),
            name if name.bytes().all(|b| b.is_ascii_uppercase() || b == b'_') => {
                EventData::Discord(raw.data)
            }
            _ => EventData::Other(raw.data),
        };
        Ok(Event { event: raw.event, guild_id: raw.guild_id, channel_id: raw.channel_id, data })
    }
}

/// What `handle_job` receives: a run created with [`schedule::create`](crate::schedule::create).
///
/// ```ignore
/// #[plugin_fn]
/// pub fn handle_job(Json(job): Json<Job>) -> FnResult<Json<Done>> {
///     let reminder: Reminder = job.data()?;
///     messages::send(job.channel_id.as_deref(), format!("<@{}>: {}", reminder.user, reminder.text))?;
///     Ok(Json(Done))
/// }
/// ```
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    /// The key given to [`Schedule::key`](crate::Schedule::key), if any.
    pub key: Option<String>,
    pub guild_id: String,
    /// The channel the run was created from. `messages::send(None, ..)` posts there.
    pub channel_id: Option<String>,
    /// What was given to [`Schedule::data`](crate::Schedule::data), raw. See [`data`](Self::data).
    #[serde(default)]
    pub data: Value,
}

impl Job {
    /// The job's data as your own type.
    pub fn data<T: DeserializeOwned>(&self) -> Result<T, serde_json::Error> {
        T::deserialize(&self.data)
    }
}
