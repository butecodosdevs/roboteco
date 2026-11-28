//! Test fixture for `pnpm test`: speaks the plugin contract as raw JSON.
use extism_pdk::*;
use serde_json::{json, Value};

#[host_fn]
extern "ExtismHost" {
    fn call(request: Json<Value>) -> Json<Value>;
}

fn reply(content: String) -> Value {
    json!({ "actions": [{ "type": "reply", "content": content }] })
}

#[plugin_fn]
pub fn manifest() -> FnResult<Json<Value>> {
    Ok(Json(json!({
        "name": "contract", "version": "1.0.0",
        "commands": [
            { "name": "panel", "description": "A message with a button and a select" },
            { "name": "form", "description": "Opens a form" },
            { "name": "staff", "description": "Staff only", "defaultMemberPermissions": ["BanMembers"] },
            { "name": "spin", "description": "Never answers" },
            { "name": "alloc", "description": "Allocates until the sandbox stops it" }
        ],
        "contextMenus": [{ "type": "user", "name": "Inspect" }],
        "events": ["memberJoin"],
        "discordEvents": ["MESSAGE_CREATE", "MESSAGE_DELETE"],
        "uses": ["kv.increment", "kv.set"]
    })))
}

#[plugin_fn]
pub fn handle_command(Json(input): Json<Value>) -> FnResult<Json<Value>> {
    let out = match (input["kind"].as_str(), input["command"].as_str()) {
        (Some("userMenu"), _) => reply(format!("inspected {}", input["target"]["userId"].as_str().unwrap_or("?"))),
        (_, Some("panel")) => json!({ "actions": [{
            "type": "reply",
            "embeds": [{ "title": "Panel", "description": "count: 0" }],
            "components": [
                [{ "type": "button", "style": "primary", "id": "inc", "label": "+1" }],
                [{ "type": "select", "id": "pick", "options": [
                    { "label": "Red", "value": "red" }, { "label": "Blue", "value": "blue" }
                ], "max": 2 }]
            ]
        }]}),
        (_, Some("form")) => json!({ "actions": [{
            "type": "modal", "id": "feedback", "title": "Feedback",
            "fields": [{ "id": "text", "label": "What do you think?", "style": "paragraph" }]
        }]}),
        (_, Some("staff")) => reply("staff only".into()),
        (_, Some("spin")) => loop {},
        (_, Some("alloc")) => {
            let mut chunks: Vec<Vec<u8>> = Vec::new();
            loop {
                chunks.push(vec![1u8; 1 << 20]);
                std::hint::black_box(&chunks);
            }
        }
        _ => reply("unknown".into()),
    };
    Ok(Json(out))
}

#[plugin_fn]
pub fn handle_component(Json(input): Json<Value>) -> FnResult<Json<Value>> {
    let component = &input["component"];
    let out = match component["id"].as_str().unwrap_or("") {
        "inc" => {
            let Json(n) = unsafe { call(Json(json!({ "name": "kv.increment", "input": { "key": "panel" } })))? };
            json!({ "actions": [{ "type": "update",
                "embeds": [{ "title": "Panel", "description": format!("count: {}", n["value"]["value"]) }] }] })
        }
        "pick" => json!({ "actions": [{ "type": "reply", "ephemeral": true,
            "content": format!("picked {}", component["values"].as_array().map(|v| v.iter().filter_map(|x| x.as_str()).collect::<Vec<_>>().join(",")).unwrap_or_default()) }] }),
        "noop" => json!({ "actions": [] }),
        "feedback" => reply(format!("thanks: {}", component["fields"]["text"].as_str().unwrap_or(""))),
        other => reply(format!("unknown component {other}")),
    };
    Ok(Json(out))
}

fn kv(name: &str, input: Value) -> Result<Value, Error> {
    let Json(out) = unsafe { call(Json(json!({ "name": name, "input": input })))? };
    Ok(out)
}

#[plugin_fn]
pub fn handle_event(Json(input): Json<Value>) -> FnResult<Json<Value>> {
    let event = input["event"].as_str().unwrap_or("");
    if event == "memberJoin" {
        kv("kv.increment", json!({ "key": "joins" }))?;
    } else {
        kv("kv.increment", json!({ "key": format!("gateway:{event}") }))?;
    }
    if event == "MESSAGE_CREATE" {
        let content = input["data"]["content"].as_str().unwrap_or("(none)");
        kv("kv.set", json!({ "key": "last-content", "value": content }))?;
    }
    Ok(Json(json!({})))
}

#[plugin_fn]
pub fn handle_job(Json(input): Json<Value>) -> FnResult<Json<Value>> {
    let key = format!("job:{}", input["key"].as_str().unwrap_or("none"));
    kv("kv.set", json!({ "key": key, "value": input["data"].to_string() }))?;
    Ok(Json(json!({})))
}
