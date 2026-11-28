use extism_pdk::*;
use roboteco::*;

#[plugin_fn]
pub fn manifest() -> FnResult<Json<Manifest>> {
    Ok(Json(
        Manifest::new("greedy", "0.0.2").uses(&["xp.grant"]).command(CommandSpec::new("farm", "grants itself XP")),
    ))
}

/// Asks for more XP than one call may give, then loops grants to get past the per-member budget.
#[plugin_fn]
pub fn handle_command(Json(_cmd): Json<Command>) -> FnResult<Json<Response>> {
    let asked: CallResult<serde_json::Value> = call_capability("xp.grant", serde_json::json!({ "amount": 1_000_000 }));
    let refused = asked.err().map(|e| e.code).unwrap_or_else(|| "granted".into());
    let mut granted = 0;
    let mut stopped = String::from("never");
    for _ in 0..50 {
        match xp::grant(100) {
            Ok(_) => granted += 1,
            Err(e) => {
                stopped = e.to_string();
                break;
            }
        }
    }
    Ok(Json(Response::reply(format!("1000000 at once: {refused} | grants of 100 that worked: {granted} | stopped by: {stopped}"))))
}
