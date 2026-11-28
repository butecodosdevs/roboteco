package roboteco

import (
	"encoding/json"
	"slices"
	"strings"
)

// Kinds of Command, in Command.Kind.
const (
	KindCommand      = "command"
	KindAutocomplete = "autocomplete"
	KindUserMenu     = "userMenu"
	KindMessageMenu  = "messageMenu"
	KindButton       = "button"
	KindSelect       = "select"
	KindModal        = "modal"
)

// Command is what handle_command, handle_component and autocomplete receive: a slash command,
// a context menu, a button click, a select pick or a form submit (see Kind).
type Command struct {
	Kind string `json:"kind"`
	// Command is the command or menu name; empty for components.
	Command    string         `json:"command"`
	Subcommand string         `json:"subcommand"`
	Options    map[string]any `json:"options"`
	UserID     string         `json:"userId"`
	GuildID    string         `json:"guildId"`
	ChannelID  string         `json:"channelId"`
	Locale     string         `json:"locale"`
	// Permissions are the caller's permission names in this channel, e.g. "ManageMessages".
	Permissions []string `json:"permissions"`
	Context     Context  `json:"context"`
	Resolved    Resolved `json:"resolved"`
	// Focused is the option being typed, for autocomplete.
	Focused *Focused `json:"focused"`
	// Target is what was right-clicked, for context menus.
	Target Target `json:"target"`
	// Component is what was clicked, picked or submitted, for components.
	Component ComponentData `json:"component"`
}

// String is a string option, or "" when it was not given.
func (c Command) String(name string) string { s, _ := c.Options[name].(string); return s }

// Bool is a boolean option, or false when it was not given.
func (c Command) Bool(name string) bool { b, _ := c.Options[name].(bool); return b }

// Number is a number option, or 0 when it was not given.
func (c Command) Number(name string) float64 { n, _ := c.Options[name].(float64); return n }

// Int is an integer option, or 0 when it was not given.
func (c Command) Int(name string) int64 { return int64(c.Number(name)) }

// Member is the member picked in a user option, sent along by Discord (no extra call).
func (c Command) Member(name string) *Member {
	if m, ok := c.Resolved.Members[c.String(name)]; ok {
		return &m
	}
	return nil
}

// Role is the role picked in a role option.
func (c Command) Role(name string) *Role {
	if r, ok := c.Resolved.Roles[c.String(name)]; ok {
		return &r
	}
	return nil
}

// Channel is the channel picked in a channel option.
func (c Command) Channel(name string) *Channel {
	if ch, ok := c.Resolved.Channels[c.String(name)]; ok {
		return &ch
	}
	return nil
}

// Can reports whether the caller has a permission in this channel, e.g. "ManageMessages".
func (c Command) Can(permission string) bool { return slices.Contains(c.Permissions, permission) }

// Value is the first value picked in a select, or "".
func (c Command) Value() string {
	if len(c.Component.Values) == 0 {
		return ""
	}
	return c.Component.Values[0]
}

// Values are the values picked in a select.
func (c Command) Values() []string { return c.Component.Values }

// Field is what the member typed in a form field.
func (c Command) Field(id string) string { return c.Component.Fields[id] }

// Portuguese reports whether the caller uses Discord in Portuguese.
func (c Command) Portuguese() bool { return strings.HasPrefix(c.Locale, "pt") }

// Context is what the manifest's Context asked to be pushed with every interaction.
type Context struct {
	Member  *Member  `json:"member"`
	Guild   *Guild   `json:"guild"`
	Channel *Channel `json:"channel"`
}

// Resolved holds the members, roles and channels picked in options, by ID.
type Resolved struct {
	Members  map[string]Member  `json:"members"`
	Roles    map[string]Role    `json:"roles"`
	Channels map[string]Channel `json:"channels"`
}

// Focused is the option being typed during autocomplete.
type Focused struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// Target is the member or message a context menu was opened on.
type Target struct {
	UserID string `json:"userId"`
	// Member is nil when the user is not in the server.
	Member *Member `json:"member"`
	// Message is set for message menus.
	Message *MessageData `json:"message"`
}

// ComponentData is the button, select or form an interaction came from.
type ComponentData struct {
	// ID is the plugin's own id, as given to the button, select or modal.
	ID     string            `json:"id"`
	Values []string          `json:"values"`
	Fields map[string]string `json:"fields"`
	// MessageID is the message the component is on; empty for forms opened by a command.
	MessageID string `json:"messageId"`
}

// MessageData is a message someone posted.
type MessageData struct {
	ID          string   `json:"id"`
	ChannelID   string   `json:"channelId"`
	AuthorID    string   `json:"authorId"`
	Content     string   `json:"content"`
	Attachments []string `json:"attachments"`
}

// Member is a member of the server.
type Member struct {
	ID          string   `json:"id"`
	Username    string   `json:"username"`
	DisplayName string   `json:"displayName"`
	AvatarURL   string   `json:"avatarUrl"`
	Bot         bool     `json:"bot"`
	Owner       bool     `json:"owner"`
	Roles       []string `json:"roles"`
	JoinedAt    *string  `json:"joinedAt"`
}

// Guild is the server.
type Guild struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	MemberCount int     `json:"memberCount"`
	Locale      string  `json:"locale"`
	IconURL     *string `json:"iconUrl"`
}

// Channel is a channel of the server; Type is Discord's channel type number.
type Channel struct {
	ID   string  `json:"id"`
	Name *string `json:"name"`
	Type int     `json:"type"`
}

// Role is a role of the server. Managed and Elevated are only set by Discord.Roles.
type Role struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Color    int    `json:"color"`
	Position int    `json:"position"`
	// Managed roles belong to an integration and cannot be given or taken.
	Managed bool `json:"managed"`
	// Elevated roles grant staff permissions.
	Elevated bool `json:"elevated"`
}

// Event is what handle_event receives. Use the typed accessors (MessageCreate, LevelUp, ...)
// to read Data; each returns nil for other events.
type Event struct {
	Event   string `json:"event"`
	GuildID string `json:"guildId"`
	// ChannelID is set for messageCreate and reactionAdd; other events have no channel, so
	// Messages.Send needs an explicit one there.
	ChannelID string          `json:"channelId"`
	Data      json.RawMessage `json:"data"`
}

func decodeEvent[T any](e Event, name string) *T {
	if e.Event != name {
		return nil
	}
	var out T
	if json.Unmarshal(e.Data, &out) != nil {
		return nil
	}
	return &out
}

// MessageCreate is the data of EventMessageCreate.
type MessageCreate struct {
	Message MessageData `json:"message"`
	// Member is nil for webhooks and members who just left.
	Member *Member `json:"member"`
}

// MemberJoin is the data of EventMemberJoin.
type MemberJoin struct {
	Member Member `json:"member"`
}

// MemberLeave is the data of EventMemberLeave.
type MemberLeave struct {
	UserID   string   `json:"userId"`
	Username string   `json:"username"`
	Roles    []string `json:"roles"`
}

// ReactionAdd is the data of EventReactionAdd. Emoji is the unicode emoji or the custom emoji ID.
type ReactionAdd struct {
	MessageID string `json:"messageId"`
	ChannelID string `json:"channelId"`
	UserID    string `json:"userId"`
	Emoji     string `json:"emoji"`
}

// LevelUp is the data of EventLevelUp.
type LevelUp struct {
	UserID string `json:"userId"`
	Level  int64  `json:"level"`
	XP     int64  `json:"xp"`
}

// CaseCreated is the data of EventCaseCreated: a moderation case was opened.
type CaseCreated struct {
	Number      int64  `json:"number"`
	Action      string `json:"action"`
	TargetID    string `json:"targetId"`
	ModeratorID string `json:"moderatorId"`
	// Reason is "" when none was given.
	Reason string `json:"reason"`
	// DurationSeconds is 0 for actions without a duration.
	DurationSeconds int64 `json:"durationSeconds"`
}

// MessageCreate is the event's data when it is EventMessageCreate, or nil.
func (e Event) MessageCreate() *MessageCreate {
	return decodeEvent[MessageCreate](e, EventMessageCreate)
}

// MemberJoin is the event's data when it is EventMemberJoin, or nil.
func (e Event) MemberJoin() *MemberJoin { return decodeEvent[MemberJoin](e, EventMemberJoin) }

// MemberLeave is the event's data when it is EventMemberLeave, or nil.
func (e Event) MemberLeave() *MemberLeave { return decodeEvent[MemberLeave](e, EventMemberLeave) }

// ReactionAdd is the event's data when it is EventReactionAdd, or nil.
func (e Event) ReactionAdd() *ReactionAdd { return decodeEvent[ReactionAdd](e, EventReactionAdd) }

// LevelUp is the event's data when it is EventLevelUp, or nil.
func (e Event) LevelUp() *LevelUp { return decodeEvent[LevelUp](e, EventLevelUp) }

// CaseCreated is the event's data when it is EventCaseCreated, or nil.
func (e Event) CaseCreated() *CaseCreated { return decodeEvent[CaseCreated](e, EventCaseCreated) }

// Job is what handle_job receives: the key and data given to Schedule.In or Schedule.At.
type Job struct {
	Key     string `json:"key"`
	GuildID string `json:"guildId"`
	// ChannelID is where the run was scheduled from; Messages.Send("") posts there.
	ChannelID string          `json:"channelId"`
	Data      json.RawMessage `json:"data"`
}

// Decode reads the job's data into v.
func (j Job) Decode(v any) error { return json.Unmarshal(j.Data, v) }
