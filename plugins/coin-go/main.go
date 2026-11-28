package main

import (
	"fmt"
	"math/rand/v2"
	"strings"

	"roboteco.dev/sdk"
)

//go:wasmexport manifest
func manifest() int32 {
	return roboteco.Manifest(roboteco.Plugin{
		Name:    "coin",
		Version: "0.4.0",
		Uses:    []string{"kv.increment", "kv.get"},
		Commands: []roboteco.CommandSpec{{
			Name:                     "coin",
			Description:              "Flip coins",
			NameLocalizations:        roboteco.Localized{"pt-BR": "moeda"},
			DescriptionLocalizations: roboteco.Localized{"pt-BR": "Joga moedas"},
			Subcommands: []roboteco.SubcommandSpec{
				{
					Name: "flip", Description: "Flip a coin",
					NameLocalizations:        roboteco.Localized{"pt-BR": "jogar"},
					DescriptionLocalizations: roboteco.Localized{"pt-BR": "Joga uma moeda"},
					Options: []roboteco.OptionSpec{{
						Type: "string", Name: "call", Description: "Heads or tails?", Required: true,
						NameLocalizations: roboteco.Localized{"pt-BR": "aposta"},
						Choices:           roboteco.Choices("heads", "tails"),
					}},
				},
				{
					Name: "stats", Description: "Your flip results",
					NameLocalizations:        roboteco.Localized{"pt-BR": "placar"},
					DescriptionLocalizations: roboteco.Localized{"pt-BR": "Seus resultados"},
				},
			},
		}},
	})
}

//go:wasmexport handle_command
func handleCommand() int32 { return roboteco.HandleCommand(run) }

//go:wasmexport handle_component
func handleComponent() int32 { return roboteco.HandleComponent(click) }

func run(cmd roboteco.Command) (roboteco.Response, error) {
	switch cmd.Subcommand {
	case "flip":
		msg, err := flip(cmd.UserID, cmd.String("call"))
		return roboteco.ReplyWith(msg), err
	case "stats":
		won, _, _ := roboteco.KV.Get("flips:" + cmd.UserID + ":won")
		lost, _, _ := roboteco.KV.Get("flips:" + cmd.UserID + ":lost")
		stats := roboteco.Embed{Title: "🪙 Coin flips", Color: 0xF1C40F}.
			Inline("Won", orZero(won)).
			Inline("Lost", orZero(lost))
		if m := cmd.Context.Member; m != nil {
			stats = stats.WithAuthor(m.DisplayName, m.AvatarURL)
		}
		return roboteco.Reply("").WithEmbed(stats), nil
	}
	return roboteco.Private("Unknown subcommand " + cmd.Subcommand + "."), nil
}

// The button id carries the call, so whoever clicks flips again with the same bet.
func click(cmd roboteco.Command) (roboteco.Response, error) {
	call, ok := strings.CutPrefix(cmd.Component.ID, "again:")
	if !ok {
		return roboteco.Private("This button is no longer supported."), nil
	}
	msg, err := flip(cmd.UserID, call)
	return roboteco.Update(msg), err
}

func flip(userID, call string) (roboteco.Message, error) {
	side := []string{"heads", "tails"}[rand.IntN(2)]
	result := "lost"
	if call == side {
		result = "won"
	}
	if _, err := roboteco.KV.Increment("flips:"+userID+":"+result, 1); err != nil {
		return roboteco.Message{}, err
	}
	text := fmt.Sprintf("🪙 **%s**, <@%s> called %s: they %s! (from Go)", side, userID, call, result)
	return roboteco.Text(text).WithButtons(roboteco.Secondary("again:"+call, "Flip again").WithEmoji("🔁")), nil
}

func orZero(s string) string {
	if s == "" {
		return "0"
	}
	return s
}

func main() {}
