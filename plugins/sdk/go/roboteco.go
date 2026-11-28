// Package roboteco is the SDK for writing roboteco plugins in Go.
//
// A plugin is a WASM module with a few exports. Each export hands its work to one helper:
//
//	//go:wasmexport manifest
//	func manifest() int32 { return roboteco.Manifest(roboteco.Plugin{Name: "coin", Version: "1.0.0", ...}) }
//
//	//go:wasmexport handle_command
//	func handleCommand() int32 { return roboteco.HandleCommand(run) }
//
//	//go:wasmexport handle_component
//	func handleComponent() int32 { return roboteco.HandleComponent(click) }
//
//	//go:wasmexport handle_event
//	func handleEvent() int32 { return roboteco.HandleEvent(onEvent) }
//
//	//go:wasmexport handle_job
//	func handleJob() int32 { return roboteco.HandleJob(onJob) }
//
// Everything else goes through capabilities (KV, Levels, Messages, Schedule, ...), which the
// manifest must list in Uses and the server must grant in plugins/registry.json.
package roboteco

import (
	"encoding/json"
	"fmt"

	"github.com/extism/go-pdk"
)

//go:wasmimport extism:host/user call
func hostCall(uint64) uint64

// CallError is an error the bot returned for a capability call. Code is stable, e.g.
// not_declared, forbidden, invalid_input, rate_limited, caller_forbidden, xp_limit, no_server.
type CallError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *CallError) Error() string { return e.Code + ": " + e.Message }

// Call invokes any capability by name and decodes its result into out (which may be nil).
// Prefer the typed helpers such as KV, Messages and Schedule.
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

func logAt(level, format string, args []any) {
	message := fmt.Sprintf(format, args...)
	_ = Call("log", map[string]string{"message": message, "level": level}, nil)
}

// Log writes an info line to the bot's logs.
func Log(format string, args ...any) { logAt("info", format, args) }

// LogWarn writes a warning to the bot's logs.
func LogWarn(format string, args ...any) { logAt("warn", format, args) }

// LogError writes an error to the bot's logs.
func LogError(format string, args ...any) { logAt("error", format, args) }

// Manifest writes the plugin manifest; return its result from your `manifest` export.
func Manifest(plugin Plugin) int32 {
	if plugin.Uses == nil {
		plugin.Uses = []string{}
	}
	pdk.OutputJSON(plugin)
	return 0
}

func respond(handler func(Command) (Response, error)) int32 {
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

// HandleCommand runs handler for a slash command or context menu and writes its response;
// return its result from your `handle_command` export. An error becomes a private reply.
func HandleCommand(handler func(Command) (Response, error)) int32 { return respond(handler) }

// HandleComponent does the same for button clicks, select picks and form submits; return its
// result from your `handle_component` export. Command.Component says which one.
func HandleComponent(handler func(Command) (Response, error)) int32 { return respond(handler) }

// HandleAutocomplete runs handler for the option being typed (Command.Focused) and answers with
// up to 25 choices; return its result from your `autocomplete` export.
func HandleAutocomplete(handler func(Command) []string) int32 {
	var command Command
	if err := pdk.InputJSON(&command); err != nil {
		pdk.SetError(err)
		return 1
	}
	choices := []Choice{}
	for i, value := range handler(command) {
		if i == 25 {
			break
		}
		choices = append(choices, Choice{Name: value, Value: value})
	}
	pdk.OutputJSON(map[string]any{"choices": choices})
	return 0
}

// HandleEvent runs handler for an event the manifest subscribes to; return its result from your
// `handle_event` export. An error is written to the bot's logs.
func HandleEvent(handler func(Event) error) int32 {
	var event Event
	if err := pdk.InputJSON(&event); err != nil {
		pdk.SetError(err)
		return 1
	}
	if err := handler(event); err != nil {
		LogError("%s: %v", event.Event, err)
	}
	pdk.OutputJSON(struct{}{})
	return 0
}

// HandleJob runs handler for a run scheduled with Schedule; return its result from your
// `handle_job` export. An error is written to the bot's logs; the run is not retried.
func HandleJob(handler func(Job) error) int32 {
	var job Job
	if err := pdk.InputJSON(&job); err != nil {
		pdk.SetError(err)
		return 1
	}
	if err := handler(job); err != nil {
		LogError("job %q: %v", job.Key, err)
	}
	pdk.OutputJSON(struct{}{})
	return 0
}
