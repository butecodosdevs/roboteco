use serde_json::{json, Value};

use crate::*;

fn to_json(value: impl serde::Serialize) -> Value {
    serde_json::to_value(value).unwrap()
}

#[test]
fn reply_with_embed_buttons_and_select_matches_the_contract() {
    let response = Response::reply(
        Message::text("Pick")
            .embed(Embed::new().title("Poll").color(0x123456).inline_field("A", "1").footer("f").thumbnail(""))
            .buttons([Button::primary("yes", "Yes").emoji("👍"), Button::link("https://example.com", "Docs")])
            .select(Select::new("color").placeholder("Color").option("Red", "red").option_with(SelectOption::new("Blue", "blue").selected())),
    )
    .and_private("only you");
    assert_eq!(
        to_json(response),
        json!({ "actions": [
            {
                "type": "reply",
                "content": "Pick",
                "embeds": [{ "title": "Poll", "color": 0x123456, "fields": [{ "name": "A", "value": "1", "inline": true }], "footer": { "text": "f" } }],
                "components": [
                    [
                        { "type": "button", "style": "primary", "label": "Yes", "emoji": "👍", "id": "yes" },
                        { "type": "button", "style": "link", "label": "Docs", "url": "https://example.com" }
                    ],
                    [{ "type": "select", "id": "color", "menu": "string", "placeholder": "Color", "options": [
                        { "label": "Red", "value": "red" },
                        { "label": "Blue", "value": "blue", "default": true }
                    ] }]
                ]
            },
            { "type": "reply", "content": "only you", "ephemeral": true }
        ] })
    );
}

#[test]
fn update_and_entity_selects_carry_no_options() {
    let response = Response::update(Message::text("x").select(Select::users("who").min(0).max(30)));
    assert_eq!(
        to_json(response),
        json!({ "actions": [{ "type": "update", "content": "x", "components": [[
            { "type": "select", "id": "who", "menu": "user", "min": 0, "max": 25 }
        ]] }] })
    );
}

#[test]
fn modal_setters_apply_to_the_last_field() {
    let modal = Modal::new("ask", "Ask").short("q", "Question").length(5, 9000).paragraph("why", "Why").optional().placeholder("...");
    assert_eq!(
        to_json(Response::modal(modal)),
        json!({ "actions": [{ "type": "modal", "id": "ask", "title": "Ask", "fields": [
            { "id": "q", "label": "Question", "style": "short", "required": true, "minLength": 5, "maxLength": 4000 },
            { "id": "why", "label": "Why", "style": "paragraph", "required": false, "placeholder": "..." }
        ] }] })
    );
}

#[test]
fn manifest_lists_menus_and_events_only_when_present() {
    let plain = to_json(Manifest::new("a", "1"));
    assert!(plain.get("contextMenus").is_none() && plain.get("events").is_none());
    let full = to_json(
        Manifest::new("a", "1")
            .context_menu(ContextMenu::user("Profile").localized("pt-BR", "Perfil").default_permissions(&["ModerateMembers"]))
            .events(&["memberJoin"]),
    );
    assert_eq!(
        full["contextMenus"],
        json!([{ "type": "user", "name": "Profile", "nameLocalizations": { "pt-BR": "Perfil" }, "defaultMemberPermissions": ["ModerateMembers"] }])
    );
    assert_eq!(full["events"], json!(["memberJoin"]));
}

fn invocation(extra: Value) -> Command {
    let mut input = json!({
        "kind": "button", "command": "", "subcommand": null, "options": {}, "userId": "1", "guildId": "2",
        "channelId": "3", "locale": "pt-BR", "permissions": ["SendMessages"],
    });
    input.as_object_mut().unwrap().extend(extra.as_object().unwrap().clone());
    serde_json::from_value(input).unwrap()
}

#[test]
fn component_helpers_read_picks_and_fields() {
    let cmd = invocation(json!({ "kind": "select", "component": { "id": "color", "values": ["red", "blue"], "fields": { "t": "hi" }, "messageId": "9" } }));
    assert_eq!(cmd.kind, Kind::Select);
    assert_eq!((cmd.component_id(), cmd.value(), cmd.values().len()), ("color", Some("red"), 2));
    assert_eq!((cmd.field("t"), cmd.field("missing"), cmd.message_id()), (Some("hi"), None, Some("9")));
    assert!(cmd.can("SendMessages") && !cmd.can("ManageMessages"));
    assert!(invocation(json!({ "permissions": ["Administrator"] })).can("BanMembers"));
}

#[test]
fn context_menu_targets_and_unknown_kinds() {
    let cmd = invocation(json!({ "kind": "messageMenu", "command": "Quote", "target": {
        "userId": "7", "member": null,
        "message": { "id": "8", "channelId": "3", "authorId": "7", "content": "hey", "attachments": [] }
    } }));
    assert_eq!(cmd.kind, Kind::MessageMenu);
    assert_eq!(cmd.target_message().map(|m| m.content.as_str()), Some("hey"));
    assert!(cmd.target_member().is_none());
    assert_eq!(cmd.target_user_id(), Some("7"));
    assert_eq!(invocation(json!({ "kind": "somethingNew" })).kind, Kind::Unknown);
}

#[test]
fn events_parse_into_typed_data() {
    let event: Event = serde_json::from_value(json!({ "event": "caseCreated", "guildId": "2", "channelId": null, "data": {
        "number": 4, "action": "warn", "targetId": "5", "moderatorId": "6", "reason": null, "durationSeconds": null
    } }))
    .unwrap();
    let EventData::CaseCreated(case) = event.data else { panic!("wrong variant") };
    assert_eq!((case.number, case.target_id.as_str()), (4, "5"));

    let future: Event = serde_json::from_value(json!({ "event": "pollEnd", "guildId": "2", "channelId": "3", "data": { "x": 1 } })).unwrap();
    assert!(matches!(future.data, EventData::Other(ref v) if v["x"] == 1));

    let broken = serde_json::from_value::<Event>(json!({ "event": "levelUp", "guildId": "2", "channelId": null, "data": {} }));
    assert!(broken.is_err());
}

#[test]
fn jobs_hand_back_their_data() {
    #[derive(serde::Deserialize)]
    struct Reminder {
        text: String,
    }
    let job: Job = serde_json::from_value(json!({ "key": "r:1", "guildId": "2", "channelId": null, "data": { "text": "tea" } })).unwrap();
    assert_eq!(job.data::<Reminder>().unwrap().text, "tea");
    assert!(job.data::<u32>().is_err());
}

#[test]
fn done_is_an_empty_object() {
    assert_eq!(to_json(Done), json!({}));
}

#[test]
fn calls_outside_the_bot_fail_with_a_code() {
    let error = kv::get("x").unwrap_err();
    assert!(error.is("no_host"));
}
