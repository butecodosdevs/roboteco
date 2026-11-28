//! An activity feed built on Discord's own gateway events: voice joins, leaves and moves,
//! removed reactions, and edited or deleted messages, posted in a channel staff pick.
use extism_pdk::*;
use roboteco::*;
use serde::Deserialize;

const FEED: &str = "feed";

#[plugin_fn]
pub fn manifest() -> FnResult<Json<Manifest>> {
    Ok(Json(
        Manifest::new("activity", "1.0.0")
            .uses(&["kv.get", "kv.set", "kv.delete", "discord.messages.send"])
            .discord_events(&[
                "VOICE_STATE_UPDATE",
                "MESSAGE_REACTION_REMOVE",
                "MESSAGE_UPDATE",
                "MESSAGE_DELETE",
            ])
            .command(
                CommandSpec::new("activity", "Post server activity in a channel")
                    .localized("pt-BR", "atividade", "Posta a atividade do servidor em um canal")
                    .default_permissions(&["ManageGuild"])
                    .subcommand(
                        SubcommandSpec::new("set", "Post activity in a channel")
                            .localized("pt-BR", "definir", "Posta a atividade em um canal")
                            .option(
                                OptionSpec::channel("channel", "Where to post")
                                    .localized("pt-BR", "canal", "Onde postar")
                                    .required(),
                            ),
                    )
                    .subcommand(
                        SubcommandSpec::new("off", "Stop posting activity")
                            .localized("pt-BR", "desligar", "Para de postar a atividade"),
                    ),
            ),
    ))
}

#[plugin_fn]
pub fn handle_command(Json(cmd): Json<Command>) -> FnResult<Json<Response>> {
    let response = match (cmd.subcommand.as_deref(), cmd.id("channel")) {
        (Some("set"), Some(channel)) => {
            kv::set(FEED, channel)?;
            Response::private(format!("Server activity will be posted in <#{channel}>."))
        }
        _ => {
            kv::delete(FEED)?;
            Response::private("The activity feed is off.")
        }
    };
    Ok(Json(response))
}

// The fields this plugin reads from Discord's payloads; serde ignores the rest.
#[derive(Deserialize)]
struct VoiceState {
    user_id: String,
    channel_id: Option<String>,
}

#[derive(Deserialize)]
struct ReactionRemove {
    user_id: String,
    channel_id: String,
    message_id: String,
    emoji: Emoji,
}

#[derive(Deserialize)]
struct Emoji {
    id: Option<String>,
    name: Option<String>,
}

#[derive(Deserialize)]
struct MessageUpdate {
    id: String,
    channel_id: String,
    author: Option<Author>,
    content: Option<String>,
    edited_timestamp: Option<String>,
}

#[derive(Deserialize)]
struct Author {
    id: String,
    #[serde(default)]
    bot: bool,
}

#[derive(Deserialize)]
struct MessageDelete {
    id: String,
    channel_id: String,
}

#[plugin_fn]
pub fn handle_event(Json(event): Json<Event>) -> FnResult<Json<Done>> {
    let Some(feed) = kv::get(FEED)? else {
        return Ok(Json(Done));
    };
    let link = |channel: &str, message: &str| {
        format!("https://discord.com/channels/{}/{channel}/{message}", event.guild_id)
    };
    let line = match event.event.as_str() {
        "VOICE_STATE_UPDATE" => voice(event.decode()?)?,
        "MESSAGE_REACTION_REMOVE" => {
            let r: ReactionRemove = event.decode()?;
            let emoji = match (r.emoji.id, r.emoji.name) {
                (Some(id), Some(name)) => format!("<:{name}:{id}>"),
                (_, name) => name.unwrap_or_default(),
            };
            Some(format!("↩️ <@{}> took back {emoji} on {}", r.user_id, link(&r.channel_id, &r.message_id)))
        }
        "MESSAGE_UPDATE" => {
            let m: MessageUpdate = event.decode()?;
            match m.author {
                // Discord also sends updates when link previews load; only real edits have a timestamp.
                Some(author) if !author.bot && m.edited_timestamp.is_some() => {
                    // Without intents.MessageContent the bot strips the text, like Discord does.
                    let text = m.content.map_or("(text hidden without intents.MessageContent)".into(), |t| {
                        format!("\"{}\"", t.chars().take(300).collect::<String>())
                    });
                    Some(format!("✏️ <@{}> edited {}: {text}", author.id, link(&m.channel_id, &m.id)))
                }
                _ => None,
            }
        }
        "MESSAGE_DELETE" => {
            let m: MessageDelete = event.decode()?;
            Some(format!("🗑️ A message was deleted in <#{}> ({})", m.channel_id, m.id))
        }
        _ => None,
    };
    if let Some(line) = line {
        messages::send(Some(&feed), line)?;
    }
    Ok(Json(Done))
}

/// Discord only sends where a member is now, so where they were is kept per member.
fn voice(state: VoiceState) -> Result<Option<String>, Error> {
    let key = format!("voice:{}", state.user_id);
    let before = kv::get(&key)?;
    match &state.channel_id {
        Some(now) => kv::set(&key, now.as_str())?,
        None => {
            kv::delete(&key)?;
        }
    }
    let who = format!("<@{}>", state.user_id);
    Ok(match (before, state.channel_id) {
        (None, Some(now)) => Some(format!("🔊 {who} joined <#{now}>")),
        (Some(was), None) => Some(format!("🔈 {who} left <#{was}>")),
        (Some(was), Some(now)) if was != now => Some(format!("🔀 {who} moved from <#{was}> to <#{now}>")),
        // Mute, deafen, stream and camera changes keep the same channel.
        _ => None,
    })
}
