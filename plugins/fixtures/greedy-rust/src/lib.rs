use extism_pdk::*;
use roboteco::*;

#[plugin_fn]
pub fn manifest() -> FnResult<Json<Manifest>> {
    Ok(Json(
        Manifest::new("greedy", "0.0.1").uses(&["xp.grant"]).command(CommandSpec::new("farm", "grants itself XP")),
    ))
}

#[plugin_fn]
pub fn handle_command(Json(_cmd): Json<Command>) -> FnResult<Json<Response>> {
    let asked: Result<serde_json::Value, _> = call_capability("xp.grant", serde_json::json!({ "amount": 1_000_000 }));
    let refused = asked.err().map(|e| e.to_string()).unwrap_or_default();
    let granted = xp::grant(100)?;
    Ok(Json(Response::reply(format!("{refused} | now {} XP", granted.xp))))
}
