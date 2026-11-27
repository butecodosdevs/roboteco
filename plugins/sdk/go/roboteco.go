// Package roboteco is the SDK for writing roboteco plugins in Go.
//
//	//go:wasmexport manifest
//	func manifest() int32 { return roboteco.Manifest(roboteco.Plugin{Name: "coin", Version: "1.0.0", Commands: ...}) }
//
//	//go:wasmexport handle_command
//	func handleCommand() int32 { return roboteco.HandleCommand(run) }
package roboteco

import (
	"encoding/json"
	"fmt"

	"github.com/extism/go-pdk"
)

//go:wasmimport extism:host/user call
func hostCall(uint64) uint64

// CallError is an error the bot returned for a capability call. Code is stable:
// not_declared, invalid_input, forbidden, rate_limited, storage_full, failed, ...
type CallError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *CallError) Error() string { return e.Code + ": " + e.Message }

// Call invokes any capability by name and decodes its result into out (which may be nil).
// Prefer the typed helpers: KV, Levels, XP, Discord.
func Call(name string, input any, out any) error {
	request, err := json.Marshal(map[string]any{"name": name, "input": input})
	if err != nil {
		return err
	}
	mem := pdk.AllocateBytes(request)
	defer mem.Free()
	var response struct {
		OK    bool            `json:"ok"`
		Value json.RawMessage `json:"value"`
		Error *CallError      `json:"error"`
	}
	answer := pdk.FindMemory(hostCall(mem.Offset()))
	defer answer.Free()
	if err := json.Unmarshal(answer.ReadBytes(), &response); err != nil {
		return err
	}
	if !response.OK {
		if response.Error == nil {
			return &CallError{Code: "failed", Message: "call failed"}
		}
		return response.Error
	}
	if out == nil {
		return nil
	}
	return json.Unmarshal(response.Value, out)
}

// Log writes to the bot's logs.
func Log(format string, args ...any) {
	_ = Call("log", map[string]string{"message": fmt.Sprintf(format, args...)}, nil)
}

// Manifest writes the plugin manifest; return its result from your `manifest` export.
func Manifest(plugin Plugin) int32 {
	if plugin.Uses == nil {
		plugin.Uses = []string{}
	}
	pdk.OutputJSON(plugin)
	return 0
}

// HandleCommand reads the command, runs handler and writes its response; return its result
// from your `handle_command` export. An error becomes a private reply with the message.
func HandleCommand(handler func(Command) (Response, error)) int32 {
	var command Command
	if err := pdk.InputJSON(&command); err != nil {
		pdk.SetError(err)
		return 1
	}
	response, err := handler(command)
	if err != nil {
		response = Private(err.Error())
	}
	pdk.OutputJSON(response)
	return 0
}

// HandleAutocomplete does the same for your `autocomplete` export.
func HandleAutocomplete(handler func(Command) []string) int32 {
	var command Command
	if err := pdk.InputJSON(&command); err != nil {
		pdk.SetError(err)
		return 1
	}
	choices := []map[string]string{}
	for i, value := range handler(command) {
		if i == 25 {
			break
		}
		choices = append(choices, map[string]string{"name": value, "value": value})
	}
	pdk.OutputJSON(map[string]any{"choices": choices})
	return 0
}
