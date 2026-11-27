package roboteco

// KV is key-value storage, one space per plugin and server (permission "kv").
var KV kv

type kv struct{}

// Get returns the value and whether the key was set.
func (kv) Get(key string) (string, bool, error) {
	var out struct {
		Value *string `json:"value"`
	}
	if err := Call("kv.get", map[string]string{"key": key}, &out); err != nil || out.Value == nil {
		return "", false, err
	}
	return *out.Value, true, nil
}

func (kv) Set(key, value string) error {
	return Call("kv.set", map[string]string{"key": key, "value": value}, nil)
}

func (kv) Delete(key string) (bool, error) {
	var out struct {
		Deleted bool `json:"deleted"`
	}
	err := Call("kv.delete", map[string]string{"key": key}, &out)
	return out.Deleted, err
}

// Increment atomically adds by (missing keys start at 0) and returns the new value.
func (kv) Increment(key string, by int64) (int64, error) {
	var out struct {
		Value int64 `json:"value"`
	}
	err := Call("kv.increment", map[string]any{"key": key, "by": by}, &out)
	return out.Value, err
}

type Level struct {
	XP    int64  `json:"xp"`
	Level int64  `json:"level"`
	Rank  *int64 `json:"rank"`
}

// Levels reads this server's levels (permission "levels.read").
var Levels levels

type levels struct{}

func (levels) Get(userID string) (Level, error) {
	var out Level
	err := Call("levels.get", map[string]string{"userId": userID}, &out)
	return out, err
}

// XP grants XP to the member who ran the command (permission "xp.grant").
var XP xp

type xp struct{}

func (xp) Grant(amount int) (Level, error) {
	var out Level
	err := Call("xp.grant", map[string]int{"amount": amount}, &out)
	return out, err
}

// Discord reads Discord data the plugin didn't get pushed (permission "discord.read").
var Discord discord

type discord struct{}

func (discord) Member(userID string) (*Member, error) {
	var out struct {
		Member *Member `json:"member"`
	}
	err := Call("discord.member.get", map[string]string{"userId": userID}, &out)
	return out.Member, err
}
