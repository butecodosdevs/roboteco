use std::collections::HashMap;

use serde::Deserialize;
use serde_json::Value;

/// What `handle_command`, `autocomplete` and `handle_component` receive.
///
/// One shape covers slash commands, context menus, autocomplete, button clicks, select picks and
/// form submits; [`kind`](Self::kind) says which. The option helpers ([`string`](Self::string),
/// [`member`](Self::member), …) read slash command options, [`target_member`](Self::target_member)
/// and [`target_message`](Self::target_message) read context menus, and
/// [`component_id`](Self::component_id), [`value`](Self::value) and [`field`](Self::field) read
/// clicks, picks and forms.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Command {
    /// What was used: a slash command, a menu, a button, …
    #[serde(default)]
    pub kind: Kind,
    /// The command or context menu name; empty for buttons, selects and forms.
    #[serde(default)]
    pub command: String,
    pub subcommand: Option<String>,
    /// Slash command options by name. Prefer the typed helpers.
    #[serde(default)]
    pub options: HashMap<String, Value>,
    /// Who used it.
    pub user_id: String,
    pub guild_id: String,
    pub channel_id: String,
    /// The member's Discord locale, e.g. `en-US` or `pt-BR`.
    pub locale: String,
    /// The member's permission names in this channel, e.g. `ManageMessages`. See [`can`](Self::can).
    #[serde(default)]
    pub permissions: Vec<String>,
    /// What the manifest's [`context`](crate::Manifest::context) asked to be pushed.
    #[serde(default)]
    pub context: Context,
    /// Members, roles and channels picked in options or selects, by ID.
    #[serde(default)]
    pub resolved: Resolved,
    /// Autocomplete only: the option being typed.
    pub focused: Option<Focused>,
    /// Context menus only: the member or message that was right-clicked.
    pub target: Option<Target>,
    /// Buttons, selects and forms only: which one, and what was picked or typed.
    pub component: Option<Component>,
}

/// What a [`Command`] input came from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Kind {
    /// A slash command.
    #[default]
    Command,
    /// A member is typing in an option marked `.autocomplete()`.
    Autocomplete,
    /// A [`ContextMenu::user`](crate::ContextMenu::user) menu.
    UserMenu,
    /// A [`ContextMenu::message`](crate::ContextMenu::message) menu.
    MessageMenu,
    /// A [`Button`](crate::Button) click.
    Button,
    /// A [`Select`](crate::Select) pick.
    Select,
    /// A [`Modal`](crate::Modal) submit.
    Modal,
    /// Sent by a newer bot than this SDK knows.
    #[serde(other)]
    Unknown,
}

impl Command {
    /// A string option.
    pub fn string(&self, name: &str) -> Option<&str> {
        self.options.get(name).and_then(Value::as_str)
    }
    /// An integer option.
    pub fn integer(&self, name: &str) -> Option<i64> {
        self.options.get(name).and_then(Value::as_i64)
    }
    /// A number option.
    pub fn number(&self, name: &str) -> Option<f64> {
        self.options.get(name).and_then(Value::as_f64)
    }
    /// A boolean option.
    pub fn boolean(&self, name: &str) -> Option<bool> {
        self.options.get(name).and_then(Value::as_bool)
    }
    /// The ID of a `user`, `role` or `channel` option.
    pub fn id(&self, name: &str) -> Option<&str> {
        self.string(name)
    }
    /// The member picked in a `user` option, sent along by Discord (no extra call).
    pub fn member(&self, name: &str) -> Option<&Member> {
        self.string(name).and_then(|id| self.resolved.members.get(id))
    }
    /// The role picked in a `role` option.
    pub fn role(&self, name: &str) -> Option<&Role> {
        self.string(name).and_then(|id| self.resolved.roles.get(id))
    }
    /// The channel picked in a `channel` option.
    pub fn channel(&self, name: &str) -> Option<&Channel> {
        self.string(name).and_then(|id| self.resolved.channels.get(id))
    }
    /// Whether the member's locale is Portuguese.
    pub fn is_portuguese(&self) -> bool {
        self.locale.starts_with("pt")
    }

    /// Whether the member has a permission in this channel, e.g. `cmd.can("ManageMessages")`.
    /// Administrators can do everything. Buttons anyone can click should check this themselves.
    pub fn can(&self, permission: &str) -> bool {
        self.permissions.iter().any(|p| p == permission || p == "Administrator")
    }

    /// The plugin's own id of the clicked button, picked select or submitted form; empty otherwise.
    pub fn component_id(&self) -> &str {
        self.component.as_ref().map_or("", |c| c.id.as_str())
    }
    /// The first value picked in a select.
    pub fn value(&self) -> Option<&str> {
        self.values().first().map(String::as_str)
    }
    /// Every value picked in a select (option values, or user, role or channel IDs).
    pub fn values(&self) -> &[String] {
        self.component.as_ref().map_or(&[], |c| c.values.as_slice())
    }
    /// What the member typed in a form field, by the field's id. Optional fields left empty are `""`.
    pub fn field(&self, id: &str) -> Option<&str> {
        self.component.as_ref().and_then(|c| c.fields.get(id)).map(String::as_str)
    }
    /// The message the clicked button or select is on.
    pub fn message_id(&self) -> Option<&str> {
        self.component.as_ref().and_then(|c| c.message_id.as_deref())
    }

    /// The right-clicked member (user menus). `None` when they are not in the server.
    pub fn target_member(&self) -> Option<&Member> {
        self.target.as_ref().and_then(|t| t.member.as_ref())
    }
    /// The right-clicked message (message menus).
    pub fn target_message(&self) -> Option<&MessageData> {
        self.target.as_ref().and_then(|t| t.message.as_ref())
    }
    /// The right-clicked user, or the author of the right-clicked message.
    pub fn target_user_id(&self) -> Option<&str> {
        self.target.as_ref().map(|t| t.user_id.as_str())
    }
}

/// Data pushed with every call, as asked by the manifest's [`context`](crate::Manifest::context).
#[derive(Debug, Clone, Default, Deserialize)]
pub struct Context {
    /// The member who used the command (`"member"`).
    pub member: Option<Member>,
    /// The server (`"guild"`).
    pub guild: Option<Guild>,
    /// The channel (`"channel"`).
    pub channel: Option<Channel>,
}

/// Members, roles and channels Discord sent along with the interaction, by ID.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct Resolved {
    #[serde(default)]
    pub members: HashMap<String, Member>,
    #[serde(default)]
    pub roles: HashMap<String, Role>,
    #[serde(default)]
    pub channels: HashMap<String, Channel>,
}

/// The option a member is typing in, for `autocomplete`.
#[derive(Debug, Clone, Deserialize)]
pub struct Focused {
    pub name: String,
    pub value: String,
}

/// What a context menu was used on.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Target {
    /// The right-clicked user, or the message's author.
    pub user_id: String,
    /// User menus: the member, when they are in the server.
    pub member: Option<Member>,
    /// Message menus: the message.
    pub message: Option<MessageData>,
}

/// A button click, select pick or form submit.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Component {
    /// The id the plugin gave the button, select or form.
    pub id: String,
    /// Select picks.
    #[serde(default)]
    pub values: Vec<String>,
    /// Form fields by id.
    #[serde(default)]
    pub fields: HashMap<String, String>,
    /// The message the component is on; `None` for forms opened from a command.
    pub message_id: Option<String>,
}

/// A server member.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Member {
    pub id: String,
    pub username: String,
    /// Server nickname, or global name, or username.
    pub display_name: String,
    /// May be empty.
    pub avatar_url: String,
    pub bot: bool,
    /// Whether they own the server.
    pub owner: bool,
    /// Role IDs.
    pub roles: Vec<String>,
    /// ISO 8601.
    pub joined_at: Option<String>,
}

/// A server.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Guild {
    pub id: String,
    pub name: String,
    pub member_count: u64,
    pub locale: String,
    pub icon_url: Option<String>,
}

/// A channel.
#[derive(Debug, Clone, Deserialize)]
pub struct Channel {
    pub id: String,
    pub name: Option<String>,
    /// Discord channel type (0 text, 2 voice, 5 announcement, 11 thread, …).
    #[serde(rename = "type")]
    pub kind: u8,
}

/// A role picked in an option or a select.
#[derive(Debug, Clone, Deserialize)]
pub struct Role {
    pub id: String,
    pub name: String,
    pub color: u32,
    pub position: i32,
}

/// A message someone posted: a context menu target or a `messageCreate` event.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageData {
    pub id: String,
    pub channel_id: String,
    pub author_id: String,
    pub content: String,
    /// Attachment URLs.
    #[serde(default)]
    pub attachments: Vec<String>,
}
