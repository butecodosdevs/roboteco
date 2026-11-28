// Test fixture for `pnpm test`: reads each input with the Go SDK and saves what it read, written
// back out, so a field the SDK misreads shows up as missing. See plugins/fixtures/echo-rust.
package main

import (
	"encoding/json"
	"strconv"
	"unicode/utf8"

	roboteco "roboteco.dev/sdk"
)

func main() {}

// KV values are capped at 4 KB, so the document is saved in pieces under "sdk:<n>", and "sdk"
// holds how many there are once they are all written.
func save(value any) error {
	text, err := json.Marshal(value)
	if err != nil {
		return err
	}
	chunks := 0
	for start := 0; start < len(text); chunks++ {
		end := min(start+4000, len(text))
		for end < len(text) && !utf8.RuneStart(text[end]) {
			end--
		}
		if err := roboteco.KV.Set("sdk:"+strconv.Itoa(chunks), string(text[start:end])); err != nil {
			return err
		}
		start = end
	}
	return roboteco.KV.Set("sdk", strconv.Itoa(chunks))
}

func echo(cmd roboteco.Command) (roboteco.Response, error) {
	return roboteco.Private("recorded"), save(cmd)
}

//go:wasmexport manifest
func manifest() int32 {
	return roboteco.Manifest(roboteco.Plugin{
		Name: "echo-go", Version: "1.0.0",
		Commands: []roboteco.CommandSpec{{Name: "fidelity-go", Description: "Records what the Go SDK reads"}},
		Uses:     []string{"kv.set"},
	})
}

//go:wasmexport handle_command
func handleCommand() int32 { return roboteco.HandleCommand(echo) }

//go:wasmexport handle_component
func handleComponent() int32 { return roboteco.HandleComponent(echo) }

//go:wasmexport autocomplete
func autocomplete() int32 {
	return roboteco.HandleAutocomplete(func(cmd roboteco.Command) []string {
		if err := save(cmd); err != nil {
			return nil
		}
		return []string{"recorded"}
	})
}

//go:wasmexport handle_event
func handleEvent() int32 { return roboteco.HandleEvent(func(ev roboteco.Event) error { return save(ev) }) }
