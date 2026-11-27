package main

import (
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"strconv"

	"github.com/extism/go-pdk"
)

type commandInput struct {
	Command    string         `json:"command"`
	Subcommand string         `json:"subcommand"`
	Options    map[string]any `json:"options"`
	UserID     string         `json:"userId"`
	Locale     string         `json:"locale"`
}

type action struct {
	Type      string `json:"type"`
	Content   string `json:"content"`
	Ephemeral bool   `json:"ephemeral,omitempty"`
}

//go:wasmimport extism:host/user kv_get
func kvGet(uint64) uint64

//go:wasmimport extism:host/user kv_set
func kvSet(uint64) uint64

func get(key string) string {
	mem := pdk.AllocateString(key)
	defer mem.Free()
	out := pdk.FindMemory(kvGet(mem.Offset()))
	return string(out.ReadBytes())
}

func set(key, value string) {
	payload, _ := json.Marshal(map[string]string{"key": key, "value": value})
	mem := pdk.AllocateBytes(payload)
	defer mem.Free()
	kvSet(mem.Offset())
}

//go:wasmexport manifest
func manifest() int32 {
	pdk.OutputJSON(map[string]any{
		"name":    "coin",
		"version": "0.2.0",
		"commands": []any{map[string]any{
			"name":                     "coin",
			"description":              "Flip coins",
			"nameLocalizations":        map[string]string{"pt-BR": "moeda"},
			"descriptionLocalizations": map[string]string{"pt-BR": "Joga moedas"},
			"subcommands": []any{
				map[string]any{
					"name": "flip", "description": "Flip a coin",
					"nameLocalizations":        map[string]string{"pt-BR": "jogar"},
					"descriptionLocalizations": map[string]string{"pt-BR": "Joga uma moeda"},
					"options": []any{map[string]any{
						"type": "string", "name": "call", "description": "Heads or tails?", "required": true,
						"nameLocalizations": map[string]string{"pt-BR": "aposta"},
						"choices": []any{
							map[string]string{"name": "heads", "value": "heads"},
							map[string]string{"name": "tails", "value": "tails"},
						},
					}},
				},
				map[string]any{
					"name": "stats", "description": "Your flip results",
					"nameLocalizations":        map[string]string{"pt-BR": "placar"},
					"descriptionLocalizations": map[string]string{"pt-BR": "Seus resultados"},
				},
			},
		}},
	})
	return 0
}

//go:wasmexport handle_command
func handleCommand() int32 {
	var input commandInput
	if err := pdk.InputJSON(&input); err != nil {
		pdk.SetError(err)
		return 1
	}
	var content string
	switch input.Subcommand {
	case "flip":
		side := "heads"
		if rand.IntN(2) == 1 {
			side = "tails"
		}
		call, _ := input.Options["call"].(string)
		result := "lost"
		if call == side {
			result = "won"
		}
		key := "flips:" + input.UserID + ":" + result
		n, _ := strconv.Atoi(get(key))
		set(key, strconv.Itoa(n+1))
		content = fmt.Sprintf("🪙 **%s**, you called %s: you %s! (from Go)", side, call, result)
	case "stats":
		won, _ := strconv.Atoi(get("flips:" + input.UserID + ":won"))
		lost, _ := strconv.Atoi(get("flips:" + input.UserID + ":lost"))
		content = fmt.Sprintf("<@%s>: %d won, %d lost.", input.UserID, won, lost)
	default:
		content = "Unknown subcommand " + input.Subcommand + "."
	}
	pdk.OutputJSON(map[string]any{"actions": []action{{Type: "reply", Content: content}}})
	return 0
}

func main() {}
