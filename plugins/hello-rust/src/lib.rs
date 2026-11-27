use std::collections::HashMap;

use extism_pdk::*;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommandInput {
    command: String,
    options: HashMap<String, Value>,
    user_id: String,
    locale: String,
    #[serde(default)]
    focused: Option<Focused>,
}

#[derive(Deserialize)]
struct Focused {
    value: String,
}

#[derive(Serialize)]
struct KvSet {
    key: String,
    value: String,
}

#[host_fn]
extern "ExtismHost" {
    fn kv_get(key: String) -> String;
    fn kv_set(input: Json<KvSet>);
}

const STYLES: [&str; 3] = ["friendly", "loud", "pirate"];

#[plugin_fn]
pub fn manifest() -> FnResult<Json<Value>> {
    Ok(Json(json!({
        "name": "hello",
        "version": "0.2.0",
        "commands": [
            {
                "name": "hello",
                "description": "Say hello",
                "nameLocalizations": { "pt-BR": "ola" },
                "descriptionLocalizations": { "pt-BR": "Diz olá" },
                "options": [
                    {
                        "type": "user", "name": "who", "description": "Who to greet",
                        "nameLocalizations": { "pt-BR": "quem" },
                        "descriptionLocalizations": { "pt-BR": "Quem cumprimentar" }
                    },
                    {
                        "type": "string", "name": "style", "description": "How to say it", "autocomplete": true,
                        "nameLocalizations": { "pt-BR": "estilo" },
                        "descriptionLocalizations": { "pt-BR": "Como dizer" }
                    }
                ]
            },
            {
                "name": "count",
                "description": "Count how many times you ran this",
                "nameLocalizations": { "pt-BR": "contar" },
                "descriptionLocalizations": { "pt-BR": "Conta quantas vezes você usou isto" }
            }
        ]
    })))
}

#[plugin_fn]
pub fn handle_command(Json(input): Json<CommandInput>) -> FnResult<Json<Value>> {
    let content = match input.command.as_str() {
        "hello" => {
            let who = input.options.get("who").and_then(Value::as_str).unwrap_or(&input.user_id);
            let greeting = if input.locale.starts_with("pt") { "Olá" } else { "Hello" };
            let line = format!("{greeting}, <@{who}>!");
            match input.options.get("style").and_then(Value::as_str) {
                Some("loud") => format!("{}!!", line.to_uppercase()),
                Some("pirate") => format!("Ahoy! {line} ☠️"),
                _ => line,
            }
        }
        "count" => {
            let key = format!("count:{}", input.user_id);
            let next = unsafe { kv_get(key.clone())? }.parse::<u64>().unwrap_or(0) + 1;
            unsafe { kv_set(Json(KvSet { key, value: next.to_string() }))? };
            format!("<@{}> has counted **{next}** time(s).", input.user_id)
        }
        other => format!("Unknown command {other}."),
    };
    Ok(Json(json!({ "actions": [{ "type": "reply", "content": content }] })))
}

#[plugin_fn]
pub fn autocomplete(Json(input): Json<CommandInput>) -> FnResult<Json<Value>> {
    let typed = input.focused.map(|f| f.value.to_lowercase()).unwrap_or_default();
    let choices: Vec<Value> = STYLES
        .iter()
        .filter(|style| style.starts_with(&typed))
        .map(|style| json!({ "name": style, "value": style }))
        .collect();
    Ok(Json(json!({ "choices": choices })))
}
