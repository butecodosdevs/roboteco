package roboteco

import "strings"

// Command is what handle_command and autocomplete receive.
type Command struct {
	Command    string         `json:"command"`
	Subcommand string         `json:"subcommand"`
	Options    map[string]any `json:"options"`
	UserID     string         `json:"userId"`
	GuildID    string         `json:"guildId"`
	ChannelID  string         `json:"channelId"`
	Locale     string         `json:"locale"`
	Context    Context        `json:"context"`
	Resolved   Resolved       `json:"resolved"`
	Focused    *Focused       `json:"focused"`
}

func (c Command) String(name string) string { s, _ := c.Options[name].(string); return s }
func (c Command) Bool(name string) bool     { b, _ := c.Options[name].(bool); return b }
func (c Command) Int(name string) int64 {
	n, _ := c.Options[name].(float64)
	return int64(n)
}

// Member is the member picked in a user option, sent along by Discord (no extra call).
func (c Command) Member(name string) *Member {
	if m, ok := c.Resolved.Members[c.String(name)]; ok {
		return &m
	}
	return nil
}

func (c Command) Portuguese() bool { return strings.HasPrefix(c.Locale, "pt") }

type Context struct {
	Member  *Member  `json:"member"`
	Guild   *Guild   `json:"guild"`
	Channel *Channel `json:"channel"`
}

type Resolved struct {
	Members  map[string]Member  `json:"members"`
	Roles    map[string]Role    `json:"roles"`
	Channels map[string]Channel `json:"channels"`
}

type Focused struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

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

type Guild struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	MemberCount int     `json:"memberCount"`
	Locale      string  `json:"locale"`
	IconURL     *string `json:"iconUrl"`
}

type Channel struct {
	ID   string  `json:"id"`
	Name *string `json:"name"`
	Type int     `json:"type"`
}

type Role struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Color    int    `json:"color"`
	Position int    `json:"position"`
}

type action struct {
	Type      string `json:"type"`
	Content   string `json:"content"`
	Ephemeral bool   `json:"ephemeral,omitempty"`
}

// Response is what handle_command returns.
type Response struct {
	Actions []action `json:"actions"`
}

// Reply is a message everyone in the channel sees. Mentions never ping.
func Reply(content string) Response { return Response{}.AndReply(content) }

// Private is a reply only the member who ran the command sees.
func Private(content string) Response { return Response{}.AndPrivate(content) }

func (r Response) AndReply(content string) Response {
	r.Actions = append(r.Actions, action{Type: "reply", Content: content})
	return r
}

func (r Response) AndPrivate(content string) Response {
	r.Actions = append(r.Actions, action{Type: "reply", Content: content, Ephemeral: true})
	return r
}
