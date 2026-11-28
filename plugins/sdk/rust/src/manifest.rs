use std::collections::BTreeMap;

use serde::Serialize;
use serde_json::Value;

/// What `manifest` returns: the plugin's name, slash commands, context menus, events, the
/// capabilities it calls and the context it wants pushed with every call.
///
/// ```ignore
/// Manifest::new("hello", "1.0.0")
///     .uses(&["kv.increment", "levels.get"])
///     .context(&["member"])
///     .command(CommandSpec::new("hello", "Say hello"))
///     .context_menu(ContextMenu::user("Profile").localized("pt-BR", "Perfil"))
///     .events(&["memberJoin"])
/// ```
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    name: String,
    version: String,
    commands: Vec<CommandSpec>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    context_menus: Vec<ContextMenu>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    events: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    discord_events: Vec<String>,
    uses: Vec<String>,
    context: Vec<String>,
}

impl Manifest {
    /// A plugin named `name` (up to 32 characters) at `version`.
    pub fn new(name: &str, version: &str) -> Self {
        Self {
            name: name.into(),
            version: version.into(),
            commands: vec![],
            context_menus: vec![],
            events: vec![],
            discord_events: vec![],
            uses: vec![],
            context: vec![],
        }
    }
    /// Adds a slash command (up to 25). Its uses arrive in `handle_command`.
    pub fn command(mut self, command: CommandSpec) -> Self {
        self.commands.push(command);
        self
    }
    /// Adds a right-click menu (up to 5 user and 5 message menus). Its uses arrive in
    /// `handle_command` with [`Command::kind`](crate::Command::kind) `UserMenu` or `MessageMenu`.
    pub fn context_menu(mut self, menu: ContextMenu) -> Self {
        self.context_menus.push(menu);
        self
    }
    /// Events delivered to `handle_event`: `messageCreate`, `memberJoin`, `memberLeave`,
    /// `reactionAdd`, `levelUp`, `caseCreated`. Each needs an `events.*` permission in the registry.
    pub fn events(mut self, events: &[&str]) -> Self {
        self.events.extend(events.iter().map(|e| e.to_string()));
        self
    }
    /// Discord gateway events delivered to `handle_event` exactly as Discord sends them, e.g.
    /// `MESSAGE_DELETE` or `GUILD_MEMBER_UPDATE`. Each needs its intent's permission in the
    /// registry (`intents.GuildMessages`, …); read them with [`Event::decode`](crate::Event::decode).
    pub fn discord_events(mut self, events: &[&str]) -> Self {
        self.discord_events.extend(events.iter().map(|e| e.to_string()));
        self
    }
    /// Capabilities this plugin calls, e.g. `["kv.increment", "levels.get"]`.
    pub fn uses(mut self, capabilities: &[&str]) -> Self {
        self.uses.extend(capabilities.iter().map(|c| c.to_string()));
        self
    }
    /// Context pushed with every call: "member", "guild", "channel".
    pub fn context(mut self, kinds: &[&str]) -> Self {
        self.context.extend(kinds.iter().map(|c| c.to_string()));
        self
    }
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct Localizations {
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    name_localizations: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    description_localizations: BTreeMap<String, String>,
}

/// A right-click menu on a member or a message. Discord shows the name as typed (up to 32
/// characters, spaces and capitals allowed).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextMenu {
    #[serde(rename = "type")]
    kind: &'static str,
    name: String,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    name_localizations: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    default_member_permissions: Vec<String>,
}

impl ContextMenu {
    fn of(kind: &'static str, name: &str) -> Self {
        Self { kind, name: name.into(), name_localizations: BTreeMap::new(), default_member_permissions: vec![] }
    }
    /// Apps → `name` on a member. [`Command::target_member`](crate::Command::target_member) is who.
    pub fn user(name: &str) -> Self {
        Self::of("user", name)
    }
    /// Apps → `name` on a message. [`Command::target_message`](crate::Command::target_message) is which.
    pub fn message(name: &str) -> Self {
        Self::of("message", name)
    }
    /// The name in another Discord locale, e.g. `.localized("pt-BR", "Perfil")`.
    pub fn localized(mut self, locale: &str, name: &str) -> Self {
        self.name_localizations.insert(locale.into(), name.into());
        self
    }
    /// Hidden from members without these permissions, e.g. `&["ModerateMembers"]`.
    pub fn default_permissions(mut self, permissions: &[&str]) -> Self {
        self.default_member_permissions.extend(permissions.iter().map(|p| p.to_string()));
        self
    }
}

/// A slash command.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandSpec {
    name: String,
    description: String,
    #[serde(flatten)]
    localizations: Localizations,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    options: Vec<OptionSpec>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    subcommands: Vec<SubcommandSpec>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    default_member_permissions: Vec<String>,
    guild_only: bool,
}

impl CommandSpec {
    /// A command `/name` (lowercase, up to 32) with a description (up to 100).
    pub fn new(name: &str, description: &str) -> Self {
        Self {
            name: name.into(),
            description: description.into(),
            localizations: Localizations::default(),
            options: vec![],
            subcommands: vec![],
            default_member_permissions: vec![],
            guild_only: true,
        }
    }
    /// Name and description in another Discord locale, e.g. `.localized("pt-BR", "ola", "Diz olá")`.
    pub fn localized(mut self, locale: &str, name: &str, description: &str) -> Self {
        self.localizations.name_localizations.insert(locale.into(), name.into());
        self.localizations.description_localizations.insert(locale.into(), description.into());
        self
    }
    /// Adds an option (up to 25). A command has options or subcommands, not both.
    pub fn option(mut self, option: OptionSpec) -> Self {
        self.options.push(option);
        self
    }
    /// Adds a subcommand; [`Command::subcommand`](crate::Command::subcommand) says which was used.
    pub fn subcommand(mut self, subcommand: SubcommandSpec) -> Self {
        self.subcommands.push(subcommand);
        self
    }
    /// Hidden from members without these permissions, e.g. `&["ManageGuild"]`.
    pub fn default_permissions(mut self, permissions: &[&str]) -> Self {
        self.default_member_permissions.extend(permissions.iter().map(|p| p.to_string()));
        self
    }
    /// Also usable in DMs.
    pub fn allow_dms(mut self) -> Self {
        self.guild_only = false;
        self
    }
}

/// A subcommand, `/command name`.
#[derive(Debug, Clone, Serialize)]
pub struct SubcommandSpec {
    name: String,
    description: String,
    #[serde(flatten)]
    localizations: Localizations,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    options: Vec<OptionSpec>,
}

impl SubcommandSpec {
    /// A subcommand (lowercase name up to 32, description up to 100).
    pub fn new(name: &str, description: &str) -> Self {
        Self { name: name.into(), description: description.into(), localizations: Localizations::default(), options: vec![] }
    }
    /// Name and description in another Discord locale.
    pub fn localized(mut self, locale: &str, name: &str, description: &str) -> Self {
        self.localizations.name_localizations.insert(locale.into(), name.into());
        self.localizations.description_localizations.insert(locale.into(), description.into());
        self
    }
    /// Adds an option (up to 25).
    pub fn option(mut self, option: OptionSpec) -> Self {
        self.options.push(option);
        self
    }
}

/// An option of a command or subcommand. Required options must come before optional ones.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OptionSpec {
    #[serde(rename = "type")]
    kind: &'static str,
    name: String,
    description: String,
    #[serde(flatten)]
    localizations: Localizations,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    required: bool,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    autocomplete: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    choices: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    min_value: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_value: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    min_length: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_length: Option<u32>,
}

macro_rules! kinds {
    ($($fn:ident => $kind:literal),*) => {
        impl OptionSpec {
            $(
                #[doc = concat!("A `", $kind, "` option.")]
                pub fn $fn(name: &str, description: &str) -> Self { Self::of($kind, name, description) }
            )*
        }
    };
}
kinds!(string => "string", integer => "integer", number => "number", boolean => "boolean",
       user => "user", channel => "channel", role => "role");

impl OptionSpec {
    fn of(kind: &'static str, name: &str, description: &str) -> Self {
        Self {
            kind,
            name: name.into(),
            description: description.into(),
            localizations: Localizations::default(),
            required: false,
            autocomplete: false,
            choices: vec![],
            min_value: None,
            max_value: None,
            min_length: None,
            max_length: None,
        }
    }
    /// Name and description in another Discord locale. Handlers still see the English name.
    pub fn localized(mut self, locale: &str, name: &str, description: &str) -> Self {
        self.localizations.name_localizations.insert(locale.into(), name.into());
        self.localizations.description_localizations.insert(locale.into(), description.into());
        self
    }
    /// The member must fill it in. Required options come first.
    pub fn required(mut self) -> Self {
        self.required = true;
        self
    }
    /// Suggestions come from the plugin's `autocomplete` export.
    pub fn autocomplete(mut self) -> Self {
        self.autocomplete = true;
        self
    }
    /// Fixed values to pick from (up to 25). Not with [`autocomplete`](Self::autocomplete).
    pub fn choices(mut self, values: &[&str]) -> Self {
        self.choices = values.iter().map(|v| serde_json::json!({ "name": v, "value": v })).collect();
        self
    }
    /// Bounds of an `integer` or `number` option.
    pub fn range(mut self, min: f64, max: f64) -> Self {
        self.min_value = Some(min);
        self.max_value = Some(max);
        self
    }
    /// The shortest a `string` option may be.
    pub fn min_length(mut self, length: u32) -> Self {
        self.min_length = Some(length);
        self
    }
    /// The longest a `string` option may be.
    pub fn max_length(mut self, length: u32) -> Self {
        self.max_length = Some(length);
        self
    }
}
