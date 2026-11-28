use extism_pdk::*;
use roboteco::*;

const STYLES: [&str; 3] = ["friendly", "loud", "pirate"];
const BLURPLE: u32 = 0x5865F2;

#[plugin_fn]
pub fn manifest() -> FnResult<Json<Manifest>> {
    Ok(Json(
        Manifest::new("hello", "0.5.0")
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
            )
            .command(CommandSpec::new("flavor", "Pick an ice cream flavor").localized("pt-BR", "sabor", "Escolhe um sabor de sorvete"))
            .command(CommandSpec::new("feedback", "Send feedback").localized("pt-BR", "opiniao", "Manda sua opinião"))
            .context_menu(ContextMenu::user("Profile").localized("pt-BR", "Perfil"))
            .context_menu(ContextMenu::message("Quote").localized("pt-BR", "Citar")),
    ))
}

/// Slash commands and context menus.
#[plugin_fn]
pub fn handle_command(Json(cmd): Json<Command>) -> FnResult<Json<Response>> {
    let response = match (cmd.kind, cmd.command.as_str()) {
        (Kind::UserMenu, _) => match cmd.target_member() {
            Some(member) => Response::private(profile(member)?),
            None => Response::private("That member is not in this server."),
        },
        (Kind::MessageMenu, _) => quote(&cmd),
        (_, "hello") => hello(&cmd),
        (_, "count") => Response::reply(counter(&cmd)?),
        (_, "profile") => match cmd.member("who").or(cmd.context.member.as_ref()) {
            Some(member) => Response::reply(profile(member)?),
            None => Response::private("That member is not in this server."),
        },
        (_, "flavor") => Response::reply(
            Message::text("Which flavor?").select(
                Select::new("flavor")
                    .placeholder("Pick one")
                    .option("Vanilla", "vanilla")
                    .option("Chocolate", "chocolate")
                    .option("Mint", "mint"),
            ),
        ),
        (_, "feedback") => Response::modal(
            Modal::new("feedback", "Feedback")
                .short("title", "Title")
                .max_length(80)
                .paragraph("details", "Details")
                .optional()
                .placeholder("Anything else?"),
        ),
        (_, other) => Response::private(format!("Unknown command {other}.")),
    };
    Ok(Json(response))
}

/// Button clicks, select picks and form submits, by the id the plugin gave them.
#[plugin_fn]
pub fn handle_component(Json(cmd): Json<Command>) -> FnResult<Json<Response>> {
    let response = match cmd.component_id() {
        "count" => Response::update(counter(&cmd)?),
        "flavor" => {
            let picked = cmd.value().unwrap_or("nothing");
            Response::update(format!("<@{}> picked **{picked}**.", cmd.user_id))
        }
        "feedback" => Response::private(
            Embed::new()
                .title(cmd.field("title").unwrap_or_default())
                .description(cmd.field("details").filter(|d| !d.is_empty()).unwrap_or("(no details)"))
                .footer("Thanks for the feedback!"),
        ),
        other => Response::private(format!("Unknown component {other}.")),
    };
    Ok(Json(response))
}

#[plugin_fn]
pub fn autocomplete(Json(cmd): Json<Command>) -> FnResult<Json<Choices>> {
    let typed = cmd.focused.map(|f| f.value).unwrap_or_default();
    Ok(Json(Choices::matching(&typed, STYLES)))
}

fn hello(cmd: &Command) -> Response {
    let who = cmd.id("who").unwrap_or(&cmd.user_id);
    let line = format!("{}, <@{who}>!", if cmd.is_portuguese() { "Olá" } else { "Hello" });
    Response::reply(match cmd.string("style") {
        Some("loud") => format!("{}!!", line.to_uppercase()),
        Some("pirate") => format!("Ahoy! {line} ☠️"),
        _ => line,
    })
}

/// `/count` and its button both bump the counter of whoever used them.
fn counter(cmd: &Command) -> Result<Message, Error> {
    let total = kv::increment(&format!("count:{}", cmd.user_id), 1)?;
    Ok(Message::text(format!("<@{}> has counted **{total}** time(s).", cmd.user_id))
        .buttons([Button::primary("count", "Count again").emoji("➕")]))
}

fn profile(member: &Member) -> Result<Embed, Error> {
    let level = levels::get(&member.id)?;
    let rank = level.rank.map_or("unranked".to_string(), |r| format!("#{r}"));
    Ok(Embed::new()
        .author_with_icon(&member.display_name, &member.avatar_url)
        .color(BLURPLE)
        .inline_field("Level", level.level.to_string())
        .inline_field("XP", level.xp.to_string())
        .inline_field("Rank", rank)
        .footer(format!("{} role(s)", member.roles.len())))
}

fn quote(cmd: &Command) -> Response {
    let Some(message) = cmd.target_message().filter(|m| !m.content.is_empty()) else {
        return Response::private("That message has no text to quote.");
    };
    Response::reply(Embed::new().description(format!("> {}\n\n<@{}>", message.content.replace('\n', "\n> "), message.author_id)).color(BLURPLE))
}
