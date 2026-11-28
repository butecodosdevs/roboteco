package roboteco

import (
	"encoding/json"
	"time"
)

// Response is what handle_command and handle_component return: up to 5 actions, or a modal alone.
//
//	return roboteco.Reply("Pick one").WithButtons(roboteco.Primary("yes", "Yes"), roboteco.Danger("no", "No")), nil
type Response struct {
	actions []action
}

type action struct {
	Type string `json:"type"`
	Message
	Ephemeral bool `json:"ephemeral,omitempty"`
	*Modal
}

// MarshalJSON writes {"actions": [...]}.
func (r Response) MarshalJSON() ([]byte, error) {
	actions := r.actions
	if actions == nil {
		actions = []action{}
	}
	return json.Marshal(map[string]any{"actions": actions})
}

// Reply is a message everyone in the channel sees. Mentions never ping.
func Reply(content string) Response { return ReplyWith(Text(content)) }

// Private is a reply only the member who used the command or component sees.
func Private(content string) Response { return PrivateWith(Text(content)) }

// ReplyWith is Reply for a full message.
func ReplyWith(msg Message) Response {
	return Response{actions: []action{{Type: "reply", Message: msg}}}
}

// PrivateWith is Private for a full message.
func PrivateWith(msg Message) Response {
	return Response{actions: []action{{Type: "reply", Message: msg, Ephemeral: true}}}
}

// Update replaces the message a button or select is on. Only for handle_component.
func Update(msg Message) Response {
	return Response{actions: []action{{Type: "update", Message: msg}}}
}

// ShowModal opens a form; the submit arrives in handle_component with Kind KindModal.
// It must be the only action.
func ShowModal(m Modal) Response {
	return Response{actions: []action{{Type: "modal", Modal: &m}}}
}

// And appends the actions of other responses, e.g. Update(msg).And(Private("Saved.")).
func (r Response) And(more ...Response) Response {
	r.actions = append(append([]action(nil), r.actions...), flatten(more)...)
	return r
}

func flatten(responses []Response) []action {
	var out []action
	for _, r := range responses {
		out = append(out, r.actions...)
	}
	return out
}

// AndReply appends a public reply.
func (r Response) AndReply(content string) Response { return r.And(Reply(content)) }

// AndPrivate appends a private reply.
func (r Response) AndPrivate(content string) Response { return r.And(Private(content)) }

func (r Response) last(change func(*Message)) Response {
	if len(r.actions) == 0 || r.actions[len(r.actions)-1].Modal != nil {
		return r
	}
	r.actions = append([]action(nil), r.actions...)
	change(&r.actions[len(r.actions)-1].Message)
	return r
}

// WithEmbed adds embeds to the last message of the response.
func (r Response) WithEmbed(embeds ...Embed) Response {
	return r.last(func(m *Message) { *m = m.WithEmbed(embeds...) })
}

// WithButtons adds a row of up to 5 buttons to the last message of the response.
func (r Response) WithButtons(buttons ...Button) Response {
	return r.last(func(m *Message) { *m = m.WithButtons(buttons...) })
}

// WithSelect adds a row holding a select to the last message of the response.
func (r Response) WithSelect(s Select) Response {
	return r.last(func(m *Message) { *m = m.WithSelect(s) })
}

// Message is a message body: content, up to 10 embeds and up to 5 rows of components.
// It needs content or an embed. Mentions in it never ping.
type Message struct {
	Content    string  `json:"content,omitempty"`
	Embeds     []Embed `json:"embeds,omitempty"`
	Components []Row   `json:"components,omitempty"`
}

// Text is a message with only content.
func Text(content string) Message { return Message{Content: content} }

// WithEmbed adds embeds.
func (m Message) WithEmbed(embeds ...Embed) Message {
	m.Embeds = append(append([]Embed(nil), m.Embeds...), embeds...)
	return m
}

// WithButtons adds a row of up to 5 buttons.
func (m Message) WithButtons(buttons ...Button) Message {
	row := make(Row, len(buttons))
	for i, b := range buttons {
		row[i] = b
	}
	m.Components = append(append([]Row(nil), m.Components...), row)
	return m
}

// WithSelect adds a row holding one select.
func (m Message) WithSelect(s Select) Message {
	m.Components = append(append([]Row(nil), m.Components...), Row{s})
	return m
}

// Row is a row of components: up to 5 Buttons, or one Select.
type Row []MessageComponent

// MessageComponent is a Button or a Select.
type MessageComponent interface{ isComponent() }

// Embed is a rich card in a message. Color is 0xRRGGBB (0 leaves it unset).
type Embed struct {
	Title       string       `json:"title,omitempty"`
	Description string       `json:"description,omitempty"`
	URL         string       `json:"url,omitempty"`
	Color       int          `json:"color,omitempty"`
	Fields      []EmbedField `json:"fields,omitempty"`
	Author      *EmbedAuthor `json:"author,omitempty"`
	Footer      *EmbedFooter `json:"footer,omitempty"`
	Image       string       `json:"image,omitempty"`
	Thumbnail   string       `json:"thumbnail,omitempty"`
	// Timestamp is an ISO 8601 time shown at the bottom; set it with WithTimestamp.
	Timestamp string `json:"timestamp,omitempty"`
}

// EmbedField is a name and value shown in an embed; Inline fields sit side by side.
type EmbedField struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Inline bool   `json:"inline,omitempty"`
}

// EmbedAuthor is the line above an embed's title.
type EmbedAuthor struct {
	Name    string `json:"name"`
	IconURL string `json:"iconUrl,omitempty"`
}

// EmbedFooter is the line at the bottom of an embed.
type EmbedFooter struct {
	Text    string `json:"text"`
	IconURL string `json:"iconUrl,omitempty"`
}

// Field adds a full-width field.
func (e Embed) Field(name, value string) Embed {
	e.Fields = append(append([]EmbedField(nil), e.Fields...), EmbedField{Name: name, Value: value})
	return e
}

// Inline adds a field that sits next to other inline fields.
func (e Embed) Inline(name, value string) Embed {
	e.Fields = append(append([]EmbedField(nil), e.Fields...), EmbedField{Name: name, Value: value, Inline: true})
	return e
}

// WithFooter sets the footer text.
func (e Embed) WithFooter(text string) Embed { e.Footer = &EmbedFooter{Text: text}; return e }

// WithAuthor sets the author line, e.g. to a member's DisplayName and AvatarURL.
func (e Embed) WithAuthor(name, iconURL string) Embed {
	e.Author = &EmbedAuthor{Name: name, IconURL: iconURL}
	return e
}

// WithTimestamp shows a time at the bottom of the embed, in each reader's time zone.
func (e Embed) WithTimestamp(t time.Time) Embed { e.Timestamp = t.UTC().Format(time.RFC3339); return e }

// Button styles for Button.Style.
const (
	StylePrimary   = "primary"
	StyleSecondary = "secondary"
	StyleSuccess   = "success"
	StyleDanger    = "danger"
	StyleLink      = "link"
)

// Button is a clickable button. Clicks arrive in handle_component with Component.ID = ID.
// Link buttons open URL instead and have no ID.
type Button struct {
	Style    string `json:"style,omitempty"`
	Label    string `json:"label,omitempty"`
	Emoji    string `json:"emoji,omitempty"`
	ID       string `json:"id,omitempty"`
	URL      string `json:"url,omitempty"`
	Disabled bool   `json:"disabled,omitempty"`
}

func (Button) isComponent() {}

// MarshalJSON adds the "type" discriminator.
func (b Button) MarshalJSON() ([]byte, error) {
	type plain Button
	return json.Marshal(struct {
		Type string `json:"type"`
		plain
	}{"button", plain(b)})
}

// Primary is a blurple button. IDs are letters, numbers, _ : . or -, up to 60.
func Primary(id, label string) Button { return Button{Style: StylePrimary, ID: id, Label: label} }

// Secondary is a grey button.
func Secondary(id, label string) Button { return Button{Style: StyleSecondary, ID: id, Label: label} }

// Success is a green button.
func Success(id, label string) Button { return Button{Style: StyleSuccess, ID: id, Label: label} }

// Danger is a red button.
func Danger(id, label string) Button { return Button{Style: StyleDanger, ID: id, Label: label} }

// Link is a button that opens url.
func Link(url, label string) Button { return Button{Style: StyleLink, URL: url, Label: label} }

// WithEmoji puts an emoji on the button.
func (b Button) WithEmoji(emoji string) Button { b.Emoji = emoji; return b }

// Disable greys the button out.
func (b Button) Disable() Button { b.Disabled = true; return b }

// Select menu kinds for Select.Menu.
const (
	MenuString  = "string"
	MenuUser    = "user"
	MenuRole    = "role"
	MenuChannel = "channel"
)

// Select is a dropdown. Picks arrive in handle_component; read them with Command.Values.
type Select struct {
	ID          string         `json:"id"`
	Menu        string         `json:"menu,omitempty"`
	Placeholder string         `json:"placeholder,omitempty"`
	Min         *int           `json:"min,omitempty"`
	Max         *int           `json:"max,omitempty"`
	Disabled    bool           `json:"disabled,omitempty"`
	Options     []SelectOption `json:"options,omitempty"`
}

func (Select) isComponent() {}

// MarshalJSON adds the "type" discriminator.
func (s Select) MarshalJSON() ([]byte, error) {
	type plain Select
	return json.Marshal(struct {
		Type string `json:"type"`
		plain
	}{"select", plain(s)})
}

// SelectOption is an entry of a StringSelect.
type SelectOption struct {
	Label       string `json:"label"`
	Value       string `json:"value"`
	Description string `json:"description,omitempty"`
	Emoji       string `json:"emoji,omitempty"`
	Default     bool   `json:"default,omitempty"`
}

// Option is a SelectOption with a label and a value.
func Option(label, value string) SelectOption { return SelectOption{Label: label, Value: value} }

// StringSelect is a dropdown of fixed options (1 to 25).
func StringSelect(id string, options ...SelectOption) Select {
	return Select{ID: id, Menu: MenuString, Options: options}
}

// UserSelect lets the member pick server members.
func UserSelect(id string) Select { return Select{ID: id, Menu: MenuUser} }

// RoleSelect lets the member pick roles.
func RoleSelect(id string) Select { return Select{ID: id, Menu: MenuRole} }

// ChannelSelect lets the member pick channels.
func ChannelSelect(id string) Select { return Select{ID: id, Menu: MenuChannel} }

// WithPlaceholder sets the text shown before anything is picked.
func (s Select) WithPlaceholder(text string) Select { s.Placeholder = text; return s }

// Range sets how many values may be picked (min 0 to 25, max 1 to 25).
func (s Select) Range(min, max int) Select { s.Min, s.Max = &min, &max; return s }

// Modal is a form of 1 to 5 text fields. Build it with NewModal and Short or Paragraph.
type Modal struct {
	ID     string       `json:"id"`
	Title  string       `json:"title"`
	Fields []ModalField `json:"fields"`
}

// ModalField is a text field of a Modal; read the answer with Command.Field(ID).
type ModalField struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Style       string `json:"style"`
	Optional    bool   `json:"-"`
	Placeholder string `json:"placeholder,omitempty"`
	Value       string `json:"value,omitempty"`
	MinLength   int    `json:"minLength,omitempty"`
	MaxLength   int    `json:"maxLength,omitempty"`
}

// MarshalJSON writes Optional as the schema's "required".
func (f ModalField) MarshalJSON() ([]byte, error) {
	type plain ModalField
	return json.Marshal(struct {
		plain
		Required bool `json:"required"`
	}{plain(f), !f.Optional})
}

// NewModal starts a form; the title is up to 45 characters.
func NewModal(id, title string) Modal { return Modal{ID: id, Title: title} }

// Short adds a one-line field.
func (m Modal) Short(id, label string) Modal {
	return m.with(ModalField{ID: id, Label: label, Style: "short"})
}

// Paragraph adds a multi-line field.
func (m Modal) Paragraph(id, label string) Modal {
	return m.with(ModalField{ID: id, Label: label, Style: "paragraph"})
}

// Optional lets the member leave the last added field empty.
func (m Modal) Optional() Modal {
	if len(m.Fields) > 0 {
		m.Fields = append([]ModalField(nil), m.Fields...)
		m.Fields[len(m.Fields)-1].Optional = true
	}
	return m
}

func (m Modal) with(f ModalField) Modal {
	m.Fields = append(append([]ModalField(nil), m.Fields...), f)
	return m
}
