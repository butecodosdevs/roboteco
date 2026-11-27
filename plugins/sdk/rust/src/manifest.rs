use std::collections::BTreeMap;

use serde::Serialize;
use serde_json::Value;

/// What `manifest` returns: the plugin's name, slash commands, the capabilities it calls and the
/// context it wants pushed with every call.
#[derive(Debug, Clone, Serialize)]
pub struct Manifest {
    name: String,
    version: String,
    commands: Vec<CommandSpec>,
    uses: Vec<String>,
    context: Vec<String>,
}

impl Manifest {
    pub fn new(name: &str, version: &str) -> Self {
        Self { name: name.into(), version: version.into(), commands: vec![], uses: vec![], context: vec![] }
    }
    pub fn command(mut self, command: CommandSpec) -> Self {
        self.commands.push(command);
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
    pub fn option(mut self, option: OptionSpec) -> Self {
        self.options.push(option);
        self
    }
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
    pub fn new(name: &str, description: &str) -> Self {
        Self { name: name.into(), description: description.into(), localizations: Localizations::default(), options: vec![] }
    }
    pub fn localized(mut self, locale: &str, name: &str, description: &str) -> Self {
        self.localizations.name_localizations.insert(locale.into(), name.into());
        self.localizations.description_localizations.insert(locale.into(), description.into());
        self
    }
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
    max_length: Option<u32>,
}

macro_rules! kinds {
    ($($fn:ident => $kind:literal),*) => {
        impl OptionSpec {
            $(pub fn $fn(name: &str, description: &str) -> Self { Self::of($kind, name, description) })*
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
            max_length: None,
        }
    }
    pub fn localized(mut self, locale: &str, name: &str, description: &str) -> Self {
        self.localizations.name_localizations.insert(locale.into(), name.into());
        self.localizations.description_localizations.insert(locale.into(), description.into());
        self
    }
    pub fn required(mut self) -> Self {
        self.required = true;
        self
    }
    /// Suggestions come from the plugin's `autocomplete` export.
    pub fn autocomplete(mut self) -> Self {
        self.autocomplete = true;
        self
    }
    pub fn choices(mut self, values: &[&str]) -> Self {
        self.choices = values.iter().map(|v| serde_json::json!({ "name": v, "value": v })).collect();
        self
    }
    pub fn range(mut self, min: f64, max: f64) -> Self {
        self.min_value = Some(min);
        self.max_value = Some(max);
        self
    }
    pub fn max_length(mut self, length: u32) -> Self {
        self.max_length = Some(length);
        self
    }
}
