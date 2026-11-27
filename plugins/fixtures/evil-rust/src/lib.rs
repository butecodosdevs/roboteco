use extism_pdk::*;
use serde_json::{json, Value};

#[plugin_fn]
pub fn manifest() -> FnResult<Json<Value>> {
    Ok(Json(json!({ "name": "evil", "version": "0.0.1", "uses": ["levels.get"], "commands": [
        { "name": "snoop", "description": "tries to read data it should not", "options": [{ "type": "string", "name": "name", "description": "capability" }, { "type": "string", "name": "input", "description": "json input" }] },
        { "name": "spin", "description": "never returns" },
        { "name": "alloc", "description": "allocates without limit" },
        { "name": "fetch", "description": "tries to reach the network", "options": [{ "type": "string", "name": "url", "description": "where" }] }
    ]})))
}

#[plugin_fn]
pub fn handle_command(Json(input): Json<Value>) -> FnResult<Json<Value>> {
    match input["command"].as_str().unwrap_or("") {
        "spin" => {
            let mut n: u64 = 0;
            loop {
                n = std::hint::black_box(n.wrapping_add(1));
            }
        }
        "alloc" => {
            let mut chunks: Vec<Vec<u8>> = Vec::new();
            loop {
                chunks.push(vec![1u8; 1 << 20]);
                std::hint::black_box(&chunks);
            }
        }
        "fetch" => {
            let req = HttpRequest::new(input["options"]["url"].as_str().unwrap_or("https://example.com"));
            let res = http::request::<()>(&req, None)?;
            Ok(Json(json!({ "actions": [{ "type": "reply", "content": format!("status {}", res.status_code()) }] })))
        }
        "snoop" => {
            let name = input["options"]["name"].as_str().unwrap_or("moderation.history");
            let request: Value = serde_json::from_str(input["options"]["input"].as_str().unwrap_or("{}")).unwrap_or(json!({}));
            let answer = match roboteco::call_capability::<_, Value>(name, request) {
                Ok(value) => json!({ "ok": true, "value": value }),
                Err(error) => match error.downcast_ref::<roboteco::CallError>() {
                    Some(e) => json!({ "ok": false, "error": { "code": e.code, "message": e.message } }),
                    None => json!({ "ok": false, "error": { "code": "sdk", "message": error.to_string() } }),
                },
            };
            Ok(Json(json!({ "actions": [{ "type": "reply", "content": answer.to_string() }] })))
        }
        _ => Ok(Json(json!({ "actions": [] }))),
    }
}
