use serde::Serialize;

/// What `handle_command` and `handle_component` return: up to 5 actions, run in order.
///
/// ```ignore
/// Response::reply("Hi!")                                   // everyone sees it
/// Response::private("Only you see this.")                  // ephemeral
/// Response::reply(Embed::new().title("Stats"))             // anything that converts to a Message
/// Response::update(Message::text("Clicked!"))              // components: replace the clicked message
/// Response::modal(Modal::new("ask", "Ask").short("q", "Question"))
/// Response::reply("Saved.").and_private("Only you see this part.")
/// ```
#[derive(Debug, Clone, Default, Serialize)]
pub struct Response {
    actions: Vec<Action>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum Action {
    Reply {
        #[serde(flatten)]
        body: Message,
        #[serde(skip_serializing_if = "std::ops::Not::not")]
        ephemeral: bool,
    },
    Update {
        #[serde(flatten)]
        body: Message,
    },
    Modal(Modal),
}

impl Response {
    /// A reply everyone in the channel sees. Mentions never ping.
    pub fn reply(body: impl Into<Message>) -> Self {
        Self::default().and_reply(body)
    }
    /// A reply only the member who used it sees.
    pub fn private(body: impl Into<Message>) -> Self {
        Self::default().and_private(body)
    }
    /// Buttons and selects only: replaces the message the component is on (content, embeds and
    /// components all at once; what you leave out is removed).
    pub fn update(body: impl Into<Message>) -> Self {
        Self::default().and_update(body)
    }
    /// Opens a form. It must be the only action, and only commands, menus, buttons and selects can
    /// open one (not a form submit). The submit arrives in `handle_component` with the modal's id.
    pub fn modal(modal: Modal) -> Self {
        Self { actions: vec![Action::Modal(modal)] }
    }
    /// Adds a public reply (the first reply answers the interaction, the next ones follow up).
    pub fn and_reply(mut self, body: impl Into<Message>) -> Self {
        self.actions.push(Action::Reply { body: body.into(), ephemeral: false });
        self
    }
    /// Adds a private reply.
    pub fn and_private(mut self, body: impl Into<Message>) -> Self {
        self.actions.push(Action::Reply { body: body.into(), ephemeral: true });
        self
    }
    /// Adds an update of the clicked message.
    pub fn and_update(mut self, body: impl Into<Message>) -> Self {
        self.actions.push(Action::Update { body: body.into() });
        self
    }
}

/// A message: text, up to 10 embeds and up to 5 rows of components. It needs text or an embed.
///
/// `&str`, `String` and [`Embed`] convert into it, so `Response::reply("hi")` works.
///
/// ```ignore
/// Message::text("Pick one")
///     .embed(Embed::new().title("Poll"))
///     .buttons([Button::success("yes", "Yes"), Button::danger("no", "No")])
///     .select(Select::new("color").option("Red", "red").option("Blue", "blue"))
/// ```
#[derive(Debug, Clone, Default, Serialize)]
pub struct Message {
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    embeds: Vec<Embed>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    components: Vec<Vec<ComponentSpec>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum ComponentSpec {
    Button(Button),
    Select(Select),
}

impl Message {
    /// An empty message; add content or an embed.
    pub fn new() -> Self {
        Self::default()
    }
    /// A message with this text (up to 2000 characters).
    pub fn text(content: impl Into<String>) -> Self {
        Self::new().content(content)
    }
    /// Sets the text (up to 2000 characters).
    pub fn content(mut self, content: impl Into<String>) -> Self {
        self.content = Some(content.into());
        self
    }
    /// Adds an embed (up to 10).
    pub fn embed(mut self, embed: Embed) -> Self {
        self.embeds.push(embed);
        self
    }
    /// Adds a row of 1 to 5 buttons (up to 5 rows in all).
    pub fn buttons(mut self, buttons: impl IntoIterator<Item = Button>) -> Self {
        self.components.push(buttons.into_iter().map(ComponentSpec::Button).collect());
        self
    }
    /// Adds a row holding one select.
    pub fn select(mut self, select: Select) -> Self {
        self.components.push(vec![ComponentSpec::Select(select)]);
        self
    }
}

impl From<&str> for Message {
    fn from(content: &str) -> Self {
        Self::text(content)
    }
}

impl From<String> for Message {
    fn from(content: String) -> Self {
        Self::text(content)
    }
}

impl From<&String> for Message {
    fn from(content: &String) -> Self {
        Self::text(content.as_str())
    }
}

impl From<Embed> for Message {
    fn from(embed: Embed) -> Self {
        Self::new().embed(embed)
    }
}

/// A rich embed. Every part is optional; Discord caps the total text at 6000 characters.
///
/// URL setters ignore empty strings, so `.thumbnail(&member.avatar_url)` is safe when a member
/// has no avatar.
///
/// ```ignore
/// Embed::new()
///     .title("Profile")
///     .color(0x5865F2)
///     .inline_field("Level", "3")
///     .inline_field("XP", "420")
///     .footer("roboteco")
/// ```
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Embed {
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    color: Option<u32>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    fields: Vec<EmbedField>,
    #[serde(skip_serializing_if = "Option::is_none")]
    author: Option<EmbedAuthor>,
    #[serde(skip_serializing_if = "Option::is_none")]
    footer: Option<EmbedFooter>,
    #[serde(skip_serializing_if = "Option::is_none")]
    image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    thumbnail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    timestamp: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct EmbedField {
    name: String,
    value: String,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    inline: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct EmbedAuthor {
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    icon_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct EmbedFooter {
    text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    icon_url: Option<String>,
}

fn url(value: impl Into<String>) -> Option<String> {
    Some(value.into()).filter(|v| !v.is_empty())
}

impl Embed {
    /// An empty embed.
    pub fn new() -> Self {
        Self::default()
    }
    /// Up to 256 characters.
    pub fn title(mut self, title: impl Into<String>) -> Self {
        self.title = Some(title.into());
        self
    }
    /// Up to 4096 characters of markdown.
    pub fn description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }
    /// Makes the title a link.
    pub fn url(mut self, link: impl Into<String>) -> Self {
        self.url = url(link);
        self
    }
    /// The side bar colour, as `0xRRGGBB`.
    pub fn color(mut self, rgb: u32) -> Self {
        self.color = Some(rgb.min(0xFF_FF_FF));
        self
    }
    /// A field on its own line (up to 25 fields; name up to 256, value up to 1024, neither empty).
    pub fn field(mut self, name: impl Into<String>, value: impl Into<String>) -> Self {
        self.fields.push(EmbedField { name: name.into(), value: value.into(), inline: false });
        self
    }
    /// A field that sits next to other inline fields.
    pub fn inline_field(mut self, name: impl Into<String>, value: impl Into<String>) -> Self {
        self.fields.push(EmbedField { name: name.into(), value: value.into(), inline: true });
        self
    }
    /// A line above the title.
    pub fn author(mut self, name: impl Into<String>) -> Self {
        self.author = Some(EmbedAuthor { name: name.into(), icon_url: None });
        self
    }
    /// A line above the title, with a small icon.
    pub fn author_with_icon(mut self, name: impl Into<String>, icon: impl Into<String>) -> Self {
        self.author = Some(EmbedAuthor { name: name.into(), icon_url: url(icon) });
        self
    }
    /// Small text at the bottom.
    pub fn footer(mut self, text: impl Into<String>) -> Self {
        self.footer = Some(EmbedFooter { text: text.into(), icon_url: None });
        self
    }
    /// Small text at the bottom, with a small icon.
    pub fn footer_with_icon(mut self, text: impl Into<String>, icon: impl Into<String>) -> Self {
        self.footer = Some(EmbedFooter { text: text.into(), icon_url: url(icon) });
        self
    }
    /// A large image at the bottom.
    pub fn image(mut self, link: impl Into<String>) -> Self {
        self.image = url(link);
        self
    }
    /// A small image at the top right.
    pub fn thumbnail(mut self, link: impl Into<String>) -> Self {
        self.thumbnail = url(link);
        self
    }
    /// A time shown next to the footer, ISO 8601 with an offset, e.g. `2026-01-31T12:00:00Z`.
    pub fn timestamp(mut self, iso: impl Into<String>) -> Self {
        self.timestamp = Some(iso.into());
        self
    }
}

/// A button. Clicks arrive in `handle_component` with [`Command::component_id`](crate::Command::component_id)
/// set to the button's id (letters, numbers, `_ : . -`, up to 60). Link buttons just open a URL.
///
/// Anyone who sees the message can click; check [`Command::can`](crate::Command::can) or
/// [`Command::user_id`](crate::Command::user_id) when a button is not for everyone.
///
/// ```ignore
/// Button::primary("vote:yes", "Yes").emoji("👍")
/// Button::link("https://example.com", "Docs")
/// ```
#[derive(Debug, Clone, Serialize)]
pub struct Button {
    style: &'static str,
    #[serde(skip_serializing_if = "String::is_empty")]
    label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    emoji: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    url: Option<String>,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    disabled: bool,
}

impl Button {
    fn styled(style: &'static str, id: impl Into<String>, label: impl Into<String>) -> Self {
        Self { style, label: label.into(), emoji: None, id: Some(id.into()), url: None, disabled: false }
    }
    /// Blurple. An empty label is fine when the button has an [`emoji`](Self::emoji).
    pub fn primary(id: impl Into<String>, label: impl Into<String>) -> Self {
        Self::styled("primary", id, label)
    }
    /// Grey.
    pub fn secondary(id: impl Into<String>, label: impl Into<String>) -> Self {
        Self::styled("secondary", id, label)
    }
    /// Green.
    pub fn success(id: impl Into<String>, label: impl Into<String>) -> Self {
        Self::styled("success", id, label)
    }
    /// Red.
    pub fn danger(id: impl Into<String>, label: impl Into<String>) -> Self {
        Self::styled("danger", id, label)
    }
    /// Opens a URL; no click reaches the plugin.
    pub fn link(url: impl Into<String>, label: impl Into<String>) -> Self {
        Self { style: "link", label: label.into(), emoji: None, id: None, url: Some(url.into()), disabled: false }
    }
    /// A unicode emoji, or a custom emoji ID.
    pub fn emoji(mut self, emoji: impl Into<String>) -> Self {
        self.emoji = Some(emoji.into());
        self
    }
    /// Shown greyed out and can't be clicked.
    pub fn disabled(mut self) -> Self {
        self.disabled = true;
        self
    }
}

/// A dropdown. Picks arrive in `handle_component`; read them with
/// [`Command::value`](crate::Command::value) or [`Command::values`](crate::Command::values).
///
/// ```ignore
/// Select::new("flavor").placeholder("Pick a flavor").option("Vanilla", "vanilla").option("Mint", "mint")
/// Select::users("invite").max(3)
/// ```
#[derive(Debug, Clone, Serialize)]
pub struct Select {
    id: String,
    menu: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    placeholder: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    min: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max: Option<u8>,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    disabled: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    options: Vec<SelectOption>,
}

impl Select {
    fn menu(menu: &'static str, id: impl Into<String>) -> Self {
        Self { id: id.into(), menu, placeholder: None, min: None, max: None, disabled: false, options: vec![] }
    }
    /// A select of your own options (1 to 25); add them with [`option`](Self::option).
    pub fn new(id: impl Into<String>) -> Self {
        Self::menu("string", id)
    }
    /// Pick server members; values are user IDs, members arrive in `resolved.members`.
    pub fn users(id: impl Into<String>) -> Self {
        Self::menu("user", id)
    }
    /// Pick roles; values are role IDs, roles arrive in `resolved.roles`.
    pub fn roles(id: impl Into<String>) -> Self {
        Self::menu("role", id)
    }
    /// Pick channels; values are channel IDs, channels arrive in `resolved.channels`.
    pub fn channels(id: impl Into<String>) -> Self {
        Self::menu("channel", id)
    }
    /// Adds an option (label and value up to 100 characters). Only for [`Select::new`].
    pub fn option(self, label: impl Into<String>, value: impl Into<String>) -> Self {
        self.option_with(SelectOption::new(label, value))
    }
    /// Adds an option with a description, an emoji or preselected.
    pub fn option_with(mut self, option: SelectOption) -> Self {
        self.options.push(option);
        self
    }
    /// Grey text shown before anything is picked (up to 150 characters).
    pub fn placeholder(mut self, text: impl Into<String>) -> Self {
        self.placeholder = Some(text.into());
        self
    }
    /// The fewest picks (0 to 25, default 1).
    pub fn min(mut self, min: u8) -> Self {
        self.min = Some(min.min(25));
        self
    }
    /// The most picks (1 to 25, default 1).
    pub fn max(mut self, max: u8) -> Self {
        self.max = Some(max.clamp(1, 25));
        self
    }
    /// Shown greyed out and can't be used.
    pub fn disabled(mut self) -> Self {
        self.disabled = true;
        self
    }
}

/// An option of a [`Select::new`] select.
#[derive(Debug, Clone, Serialize)]
pub struct SelectOption {
    label: String,
    value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    emoji: Option<String>,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    default: bool,
}

impl SelectOption {
    /// What the member sees, and what [`Command::value`](crate::Command::value) gives you.
    pub fn new(label: impl Into<String>, value: impl Into<String>) -> Self {
        Self { label: label.into(), value: value.into(), description: None, emoji: None, default: false }
    }
    /// Smaller text under the label (up to 100 characters).
    pub fn description(mut self, text: impl Into<String>) -> Self {
        self.description = Some(text.into());
        self
    }
    /// A unicode emoji, or a custom emoji ID.
    pub fn emoji(mut self, emoji: impl Into<String>) -> Self {
        self.emoji = Some(emoji.into());
        self
    }
    /// Already picked when the select appears.
    pub fn selected(mut self) -> Self {
        self.default = true;
        self
    }
}

/// A form with 1 to 5 text fields, opened with [`Response::modal`]. The submit arrives in
/// `handle_component` with the modal's id; read fields with [`Command::field`](crate::Command::field).
///
/// Fields are required unless marked [`optional`](Self::optional). The setters after
/// [`short`](Self::short) or [`paragraph`](Self::paragraph) apply to the field just added.
///
/// ```ignore
/// Modal::new("feedback", "Feedback")
///     .short("title", "Title").max_length(80)
///     .paragraph("details", "Details").optional().placeholder("Anything else?")
/// ```
#[derive(Debug, Clone, Serialize)]
pub struct Modal {
    id: String,
    title: String,
    fields: Vec<TextField>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TextField {
    id: String,
    label: String,
    style: &'static str,
    required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    placeholder: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    min_length: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_length: Option<u16>,
}

impl Modal {
    /// A form; `title` up to 45 characters.
    pub fn new(id: impl Into<String>, title: impl Into<String>) -> Self {
        Self { id: id.into(), title: title.into(), fields: vec![] }
    }
    fn field(mut self, style: &'static str, id: impl Into<String>, label: impl Into<String>) -> Self {
        self.fields.push(TextField {
            id: id.into(),
            label: label.into(),
            style,
            required: true,
            placeholder: None,
            value: None,
            min_length: None,
            max_length: None,
        });
        self
    }
    fn last(mut self, change: impl FnOnce(&mut TextField)) -> Self {
        if let Some(field) = self.fields.last_mut() {
            change(field);
        }
        self
    }
    /// Adds a one-line field (`label` up to 45 characters).
    pub fn short(self, id: impl Into<String>, label: impl Into<String>) -> Self {
        self.field("short", id, label)
    }
    /// Adds a multi-line field.
    pub fn paragraph(self, id: impl Into<String>, label: impl Into<String>) -> Self {
        self.field("paragraph", id, label)
    }
    /// The last field may be left empty.
    pub fn optional(self) -> Self {
        self.last(|f| f.required = false)
    }
    /// Grey text in the last field while it is empty (up to 100 characters).
    pub fn placeholder(self, text: impl Into<String>) -> Self {
        let text = text.into();
        self.last(|f| f.placeholder = Some(text))
    }
    /// Text the last field starts with.
    pub fn value(self, text: impl Into<String>) -> Self {
        let text = text.into();
        self.last(|f| f.value = Some(text))
    }
    /// The fewest characters the last field accepts (0 to 4000).
    pub fn min_length(self, length: u16) -> Self {
        self.last(|f| f.min_length = Some(length.min(4000)))
    }
    /// The most characters the last field accepts (1 to 4000).
    pub fn max_length(self, length: u16) -> Self {
        self.last(|f| f.max_length = Some(length.clamp(1, 4000)))
    }
    /// Both bounds of the last field's length.
    pub fn length(self, min: u16, max: u16) -> Self {
        self.min_length(min).max_length(max)
    }
}

/// What `autocomplete` returns: up to 25 suggestions.
#[derive(Debug, Clone, Default, Serialize)]
pub struct Choices {
    choices: Vec<Choice>,
}

#[derive(Debug, Clone, Serialize)]
struct Choice {
    name: String,
    value: String,
}

impl Choices {
    /// Suggests these values as they are (the first 25).
    pub fn from<S: Into<String>>(values: impl IntoIterator<Item = S>) -> Self {
        Self {
            choices: values
                .into_iter()
                .take(25)
                .map(|v| {
                    let v: String = v.into();
                    Choice { name: v.clone(), value: v }
                })
                .collect(),
        }
    }
    /// Keeps the values that start with what the member typed (case-insensitive), up to 25.
    pub fn matching<'a>(typed: &str, values: impl IntoIterator<Item = &'a str>) -> Self {
        let typed = typed.to_lowercase();
        Self::from(values.into_iter().filter(|v| v.to_lowercase().starts_with(&typed)))
    }
    /// Adds a suggestion whose shown name differs from the value the option gets.
    pub fn choice(mut self, name: impl Into<String>, value: impl Into<String>) -> Self {
        if self.choices.len() < 25 {
            self.choices.push(Choice { name: name.into(), value: value.into() });
        }
        self
    }
}
