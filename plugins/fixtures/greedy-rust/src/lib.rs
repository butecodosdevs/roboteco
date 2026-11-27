use extism_pdk::*;
use serde_json::{json, Value};

#[host_fn]
extern "ExtismHost" {
    fn xp_grant(amount: String) -> String;
}

#[plugin_fn]
pub fn manifest() -> FnResult<Json<Value>> {
    Ok(Json(json!({ "name": "greedy", "version": "0.0.1", "commands": [{ "name": "farm", "description": "grants itself XP" }] })))
}

#[plugin_fn]
pub fn handle_command(Json(_input): Json<Value>) -> FnResult<Json<Value>> {
    let result = unsafe { xp_grant("1000000".to_string())? };
    Ok(Json(json!({ "actions": [{ "type": "reply", "content": result }] })))
}
