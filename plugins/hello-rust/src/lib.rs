use extism_pdk::*;
use roboteco::*;

const STYLES: [&str; 3] = ["friendly", "loud", "pirate"];

#[plugin_fn]
pub fn manifest() -> FnResult<Json<Manifest>> {
    Ok(Json(
        Manifest::new("hello", "0.4.0")
            .uses(&["kv.increment", "levels.get"])
            .context(&["member", "guild"])
            .command(
                CommandSpec::new("hello", "Say hello")
                    .localized("pt-BR", "ola", "Diz olá")
                    .option(OptionSpec::user("who", "Who to greet").localized("pt-BR", "quem", "Quem cumprimentar"))
                    .option(OptionSpec::string("style", "How to say it").autocomplete().localized("pt-BR", "estilo", "Como dizer")),
            )
            .command(
                CommandSpec::new("count", "Count how many times you ran this")
                    .localized("pt-BR", "contar", "Conta quantas vezes você usou isto"),
            )
            .command(
                CommandSpec::new("profile", "Show someone's profile")
                    .localized("pt-BR", "perfil", "Mostra o perfil de alguém")
                    .option(OptionSpec::user("who", "Whose profile (default you)").localized("pt-BR", "quem", "De quem")),
            ),
    ))
}

#[plugin_fn]
pub fn handle_command(Json(cmd): Json<Command>) -> FnResult<Json<Response>> {
    let response = match cmd.command.as_str() {
        "hello" => {
            let who = cmd.id("who").unwrap_or(&cmd.user_id);
            let line = format!("{}, <@{who}>!", if cmd.is_portuguese() { "Olá" } else { "Hello" });
            Response::reply(match cmd.string("style") {
                Some("loud") => format!("{}!!", line.to_uppercase()),
                Some("pirate") => format!("Ahoy! {line} ☠️"),
                _ => line,
            })
        }
        "count" => {
            let total = kv::increment(&format!("count:{}", cmd.user_id), 1)?;
            Response::reply(format!("<@{}> has counted **{total}** time(s).", cmd.user_id))
        }
        "profile" => profile(&cmd)?,
        other => Response::private(format!("Unknown command {other}.")),
    };
    Ok(Json(response))
}

#[plugin_fn]
pub fn autocomplete(Json(cmd): Json<Command>) -> FnResult<Json<Choices>> {
    let typed = cmd.focused.map(|f| f.value).unwrap_or_default();
    Ok(Json(Choices::matching(&typed, STYLES)))
}

fn profile(cmd: &Command) -> Result<Response, Error> {
    // Your own member data and a picked member both arrive with the call: no lookups needed.
    let Some(member) = cmd.member("who").or(cmd.context.member.as_ref()) else {
        return Ok(Response::private("That member is not in this server."));
    };
    let level = levels::get(&member.id)?;
    let rank = level.rank.map_or("unranked".to_string(), |r| format!("#{r}"));
    let server = cmd.context.guild.as_ref().map_or("this server", |g| g.name.as_str());
    Ok(Response::reply(format!(
        "**{}** in {server} · level {} ({} XP, {rank}) · {} role(s)",
        member.display_name,
        level.level,
        level.xp,
        member.roles.len(),
    )))
}
