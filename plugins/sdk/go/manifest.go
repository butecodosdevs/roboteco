package roboteco

// Plugin is what the manifest export returns.
type Plugin struct {
	Name     string        `json:"name"`
	Version  string        `json:"version"`
	Commands []CommandSpec `json:"commands"`
	// ContextMenus are right-click menus on a member or a message; they run handle_command.
	ContextMenus []ContextMenu `json:"contextMenus,omitempty"`
	// Events lists the events handle_event receives, e.g. EventMessageCreate.
	Events []string `json:"events,omitempty"`
	// Uses lists the capabilities the plugin calls, e.g. "kv.increment", "discord.messages.send".
	Uses []string `json:"uses"`
	// Context lists what is pushed with every interaction: "member", "guild", "channel".
	Context []string `json:"context,omitempty"`
}

// Events a plugin can subscribe to in Plugin.Events, with the permission each one needs.
const (
	EventMessageCreate = "messageCreate" // events.messages
	EventMemberJoin    = "memberJoin"    // events.members
	EventMemberLeave   = "memberLeave"   // events.members
	EventReactionAdd   = "reactionAdd"   // events.reactions
	EventLevelUp       = "levelUp"       // events.levels
	EventCaseCreated   = "caseCreated"   // events.moderation
)

// Localized maps a Discord locale ("pt-BR") to a translated name or description.
type Localized map[string]string

// CommandSpec is a slash command. It has Options or Subcommands, not both.
type CommandSpec struct {
	Name                     string           `json:"name"`
	Description              string           `json:"description"`
	NameLocalizations        Localized        `json:"nameLocalizations,omitempty"`
	DescriptionLocalizations Localized        `json:"descriptionLocalizations,omitempty"`
	Options                  []OptionSpec     `json:"options,omitempty"`
	Subcommands              []SubcommandSpec `json:"subcommands,omitempty"`
	// DefaultPermissions hides the command from members without them, e.g. "ManageGuild".
	// Admins can change who sees it, so check Command.Can for anything staff-only.
	DefaultPermissions []string `json:"defaultMemberPermissions,omitempty"`
}

// SubcommandSpec is a subcommand of a CommandSpec.
type SubcommandSpec struct {
	Name                     string       `json:"name"`
	Description              string       `json:"description"`
	NameLocalizations        Localized    `json:"nameLocalizations,omitempty"`
	DescriptionLocalizations Localized    `json:"descriptionLocalizations,omitempty"`
	Options                  []OptionSpec `json:"options,omitempty"`
}

// OptionSpec is an option; Type is string, integer, number, boolean, user, channel or role.
// Required options must come before optional ones.
type OptionSpec struct {
	Type                     string    `json:"type"`
	Name                     string    `json:"name"`
	Description              string    `json:"description"`
	NameLocalizations        Localized `json:"nameLocalizations,omitempty"`
	DescriptionLocalizations Localized `json:"descriptionLocalizations,omitempty"`
	Required                 bool      `json:"required,omitempty"`
	Autocomplete             bool      `json:"autocomplete,omitempty"`
	Choices                  []Choice  `json:"choices,omitempty"`
	MinValue                 *float64  `json:"minValue,omitempty"`
	MaxValue                 *float64  `json:"maxValue,omitempty"`
	MinLength                int       `json:"minLength,omitempty"`
	MaxLength                int       `json:"maxLength,omitempty"`
}

// Choice is a fixed value for a string option.
type Choice struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// Choices builds choices whose name and value are the same.
func Choices(values ...string) []Choice {
	out := make([]Choice, len(values))
	for i, v := range values {
		out[i] = Choice{Name: v, Value: v}
	}
	return out
}

// Ptr returns a pointer to v, for OptionSpec.MinValue and MaxValue.
func Ptr[T any](v T) *T { return &v }

// Context menu types for ContextMenu.Type.
const (
	UserMenu    = "user"
	MessageMenu = "message"
)

// ContextMenu is an entry in the right-click menu of a member (UserMenu) or a message
// (MessageMenu). Discord shows Name as typed, so it may have spaces and capitals.
type ContextMenu struct {
	Type              string    `json:"type"`
	Name              string    `json:"name"`
	NameLocalizations Localized `json:"nameLocalizations,omitempty"`
	// DefaultPermissions hides the menu from members without them, e.g. "ManageMessages".
	DefaultPermissions []string `json:"defaultMemberPermissions,omitempty"`
}
