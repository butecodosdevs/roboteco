package main

import (
	"fmt"
	"math/rand/v2"

	"roboteco.dev/sdk"
)

//go:wasmexport manifest
func manifest() int32 {
	return roboteco.Manifest(roboteco.Plugin{
		Name:    "coin",
		Version: "0.3.0",
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

func run(cmd roboteco.Command) (roboteco.Response, error) {
	switch cmd.Subcommand {
	case "flip":
		side := []string{"heads", "tails"}[rand.IntN(2)]
		result := "lost"
		if cmd.String("call") == side {
			result = "won"
		}
		if _, err := roboteco.KV.Increment("flips:"+cmd.UserID+":"+result, 1); err != nil {
			return roboteco.Response{}, err
		}
		return roboteco.Reply(fmt.Sprintf("🪙 **%s**, you called %s: you %s! (from Go)", side, cmd.String("call"), result)), nil
	case "stats":
		won, _, _ := roboteco.KV.Get("flips:" + cmd.UserID + ":won")
		lost, _, _ := roboteco.KV.Get("flips:" + cmd.UserID + ":lost")
		return roboteco.Reply(fmt.Sprintf("<@%s>: %s won, %s lost.", cmd.UserID, orZero(won), orZero(lost))), nil
	}
	return roboteco.Private("Unknown subcommand " + cmd.Subcommand + "."), nil
}

func orZero(s string) string {
	if s == "" {
		return "0"
	}
	return s
}

func main() {}
