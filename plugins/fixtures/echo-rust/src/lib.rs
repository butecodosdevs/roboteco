//! Test fixture for `pnpm test` and `pnpm record-discord`: saves every input it receives, so tests
//! can compare what reached the plugin, and what the SDK read, with what Discord sent.
use extism_pdk::*;
use roboteco::{kv, Command, Event, EventData};
use serde_json::{json, Value};

const GATEWAY_EVENTS: &[&str] = &[
    "GUILD_UPDATE", "GUILD_DELETE", "GUILD_ROLE_CREATE", "GUILD_ROLE_UPDATE", "GUILD_ROLE_DELETE",
    "CHANNEL_CREATE", "CHANNEL_UPDATE", "CHANNEL_DELETE", "CHANNEL_PINS_UPDATE", "THREAD_CREATE",
    "THREAD_UPDATE", "THREAD_DELETE", "THREAD_LIST_SYNC", "THREAD_MEMBER_UPDATE",
    "STAGE_INSTANCE_CREATE", "STAGE_INSTANCE_UPDATE", "STAGE_INSTANCE_DELETE", "GUILD_MEMBER_ADD",
    "GUILD_MEMBER_UPDATE", "GUILD_MEMBER_REMOVE", "THREAD_MEMBERS_UPDATE",
    "GUILD_AUDIT_LOG_ENTRY_CREATE", "GUILD_BAN_ADD", "GUILD_BAN_REMOVE", "GUILD_EMOJIS_UPDATE",
    "GUILD_STICKERS_UPDATE", "GUILD_SOUNDBOARD_SOUND_CREATE", "GUILD_SOUNDBOARD_SOUND_UPDATE",
    "GUILD_SOUNDBOARD_SOUND_DELETE", "GUILD_SOUNDBOARD_SOUNDS_UPDATE", "GUILD_INTEGRATIONS_UPDATE",
    "INTEGRATION_CREATE", "INTEGRATION_UPDATE", "INTEGRATION_DELETE", "WEBHOOKS_UPDATE",
    "INVITE_CREATE", "INVITE_DELETE", "VOICE_STATE_UPDATE", "VOICE_CHANNEL_EFFECT_SEND",
    "PRESENCE_UPDATE", "MESSAGE_CREATE", "MESSAGE_UPDATE", "MESSAGE_DELETE", "MESSAGE_DELETE_BULK",
    "MESSAGE_REACTION_ADD", "MESSAGE_REACTION_REMOVE", "MESSAGE_REACTION_REMOVE_ALL",
    "MESSAGE_REACTION_REMOVE_EMOJI", "TYPING_START", "GUILD_SCHEDULED_EVENT_CREATE",
    "GUILD_SCHEDULED_EVENT_UPDATE", "GUILD_SCHEDULED_EVENT_DELETE",
    "GUILD_SCHEDULED_EVENT_USER_ADD", "GUILD_SCHEDULED_EVENT_USER_REMOVE",
    "AUTO_MODERATION_RULE_CREATE", "AUTO_MODERATION_RULE_UPDATE", "AUTO_MODERATION_RULE_DELETE",
    "AUTO_MODERATION_ACTION_EXECUTION", "MESSAGE_POLL_VOTE_ADD", "MESSAGE_POLL_VOTE_REMOVE",
];

// KV values are capped at 4 KB, so each document is saved in pieces under `<name>:<n>`, and
// `<name>` holds how many there are once they are all written. `input` is what the bot sent;
// `sdk` is what the SDK read from it, written back out, so a field it misreads shows up as missing.
fn save(name: &str, text: &str) -> Result<(), Error> {
    let mut chunks = Vec::new();
    let mut start = 0;
    while start < text.len() {
        let mut end = (start + 4000).min(text.len());
        while !text.is_char_boundary(end) {
            end -= 1;
        }
        chunks.push(&text[start..end]);
        start = end;
    }
    for (i, chunk) in chunks.iter().enumerate() {
        kv::set(&format!("{name}:{i}"), *chunk)?;
    }
    kv::set(name, chunks.len().to_string())?;
    Ok(())
}

fn echo(input: &Value) -> Result<(), Error> {
    save("input", &input.to_string())?;
    let sdk = match serde_json::from_value::<Command>(input.clone()) {
        Ok(command) => serde_json::to_string(&command)?,
        Err(error) => json!({ "error": error.to_string() }).to_string(),
    };
    save("sdk", &sdk)
}

fn echo_event(input: &Value) -> Result<(), Error> {
    save("input", &input.to_string())?;
    let sdk = match serde_json::from_value::<Event>(input.clone()) {
        Ok(Event { event, guild_id, channel_id, data: EventData::Discord(data) }) => {
            json!({ "event": event, "guildId": guild_id, "channelId": channel_id, "data": data })
        }
        Ok(other) => json!({ "error": format!("not read as a Discord event: {other:?}") }),
        Err(error) => json!({ "error": error.to_string() }),
    };
    save("sdk", &sdk.to_string())
}

fn private(content: &str) -> Value {
    json!({ "actions": [{ "type": "reply", "ephemeral": true, "content": content }] })
}

#[plugin_fn]
pub fn manifest() -> FnResult<Json<Value>> {
    let option = |kind: &str, name: &str| json!({ "type": kind, "name": name, "description": name });
    Ok(Json(json!({
        "name": "echo", "version": "1.0.0",
        "commands": [{
            "name": "fidelity", "description": "Records what plugins receive",
            "subcommands": [
                { "name": "options", "description": "Every option type", "options": [
                    { "type": "string", "name": "text", "description": "text", "required": true },
                    option("integer", "count"), option("number", "ratio"), option("boolean", "flag"),
                    option("user", "member"), option("channel", "place"), option("role", "group")
                ] },
                { "name": "panel", "description": "A button, a form and every kind of select" },
                { "name": "search", "description": "Autocomplete", "options": [
                    { "type": "string", "name": "query", "description": "query", "autocomplete": true }
                ] }
            ]
        }],
        "contextMenus": [{ "type": "user", "name": "Echo user" }, { "type": "message", "name": "Echo message" }],
        "context": ["member", "guild", "channel"],
        "discordEvents": GATEWAY_EVENTS,
        "uses": ["kv.set"]
    })))
}

#[plugin_fn]
pub fn handle_command(Json(input): Json<Value>) -> FnResult<Json<Value>> {
    echo(&input)?;
    if input["subcommand"] != "panel" {
        return Ok(Json(private("recorded")));
    }
    Ok(Json(json!({ "actions": [{
        "type": "reply",
        "content": "Use each of these once.",
        "components": [
            [{ "type": "button", "style": "primary", "id": "form", "label": "Open the form" }],
            [{ "type": "select", "id": "pick", "options": [
                { "label": "Red", "value": "red" }, { "label": "Blue", "value": "blue" }
            ], "max": 2 }],
            [{ "type": "select", "menu": "user", "id": "who", "max": 2 }],
            [{ "type": "select", "menu": "role", "id": "groups", "max": 2 }],
            [{ "type": "select", "menu": "channel", "id": "where", "max": 2 }]
        ]
    }]})))
}

#[plugin_fn]
pub fn autocomplete(Json(input): Json<Value>) -> FnResult<Json<Value>> {
    echo(&input)?;
    Ok(Json(json!({ "choices": [{ "name": "recorded", "value": "recorded" }] })))
}

#[plugin_fn]
pub fn handle_component(Json(input): Json<Value>) -> FnResult<Json<Value>> {
    echo(&input)?;
    if input["kind"] == "button" {
        return Ok(Json(json!({ "actions": [{
            "type": "modal", "id": "feedback", "title": "Feedback",
            "fields": [
                { "id": "short", "label": "One line", "style": "short" },
                { "id": "long", "label": "Leave this empty", "style": "paragraph", "required": false }
            ]
        }]})));
    }
    Ok(Json(private("recorded")))
}

#[plugin_fn]
pub fn handle_event(Json(input): Json<Value>) -> FnResult<Json<Value>> {
    echo_event(&input)?;
    Ok(Json(json!({})))
}
