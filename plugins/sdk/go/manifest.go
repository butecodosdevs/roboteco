package roboteco

// Plugin is what the manifest export returns.
type Plugin struct {
	Name     string        `json:"name"`
	Version  string        `json:"version"`
	Commands []CommandSpec `json:"commands"`
	// Uses lists the capabilities the plugin calls, e.g. "kv.increment", "levels.get".
	Uses []string `json:"uses"`
	// Context lists what is pushed with every call: "member", "guild", "channel".
	Context []string `json:"context,omitempty"`
}

// Localized maps a Discord locale ("pt-BR") to a translated name or description.
type Localized map[string]string

type CommandSpec struct {
	Name                     string           `json:"name"`
	Description              string           `json:"description"`
	NameLocalizations        Localized        `json:"nameLocalizations,omitempty"`
	DescriptionLocalizations Localized        `json:"descriptionLocalizations,omitempty"`
	Options                  []OptionSpec     `json:"options,omitempty"`
	Subcommands              []SubcommandSpec `json:"subcommands,omitempty"`
	// DefaultPermissions hides the command from members without them, e.g. "ManageGuild".
	DefaultPermissions []string `json:"defaultMemberPermissions,omitempty"`
}

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
	MaxLength                int       `json:"maxLength,omitempty"`
}

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
