package roboteco

import "time"

// Each group below needs its capabilities listed in Plugin.Uses and its permission granted in
// plugins/registry.json (`pnpm plugin check` prints which).

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

// Set writes a value of up to 4 KB; a server holds up to 1000 keys per plugin.
func (kv) Set(key, value string) error {
	return Call("kv.set", map[string]string{"key": key, "value": value}, nil)
}

// Delete removes a key and reports whether it existed.
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

// List returns the keys that start with prefix, sorted, at most 100.
func (kv) List(prefix string) ([]string, error) {
	var out struct {
		Keys []string `json:"keys"`
	}
	err := Call("kv.list", map[string]string{"prefix": prefix}, &out)
	return out.Keys, err
}

// Level is a member's XP, level and leaderboard position (Rank is nil without XP).
type Level struct {
	XP    int64  `json:"xp"`
	Level int64  `json:"level"`
	Rank  *int64 `json:"rank"`
}

// LeaderboardEntry is a row of Levels.Top.
type LeaderboardEntry struct {
	UserID string `json:"userId"`
	XP     int64  `json:"xp"`
	Level  int64  `json:"level"`
}

// Levels reads this server's levels (permission "levels.read").
var Levels levels

type levels struct{}

// Get returns a member's level.
func (levels) Get(userID string) (Level, error) {
	var out Level
	err := Call("levels.get", map[string]string{"userId": userID}, &out)
	return out, err
}

// Top returns the leaderboard, highest first (limit 1 to 25).
func (levels) Top(limit int) ([]LeaderboardEntry, error) {
	var out struct {
		Entries []LeaderboardEntry `json:"entries"`
	}
	err := Call("levels.top", map[string]int{"limit": limit}, &out)
	return out.Entries, err
}

// Granted is the result of an XP grant: the member's new XP and level, and how much more XP this
// plugin may give them in the current 10 minute window.
type Granted struct {
	XP        int64 `json:"xp"`
	Level     int64 `json:"level"`
	Remaining int64 `json:"remaining"`
}

// XP gives members XP (permission "xp.grant"). A plugin can give a member at most 100 XP every
// 10 minutes; past that the error code is "xp_limit".
var XP xp

type xp struct{}

// Grant gives XP (1 to 100) to the member who ran the command.
func (xp) Grant(amount int) (Granted, error) { return XP.GrantTo("", amount) }

// GrantTo gives XP (1 to 100) to a member; userID "" means the member who ran the command.
func (xp) GrantTo(userID string, amount int) (Granted, error) {
	var out Granted
	err := Call("xp.grant", struct {
		UserID string `json:"userId,omitempty"`
		Amount int    `json:"amount"`
	}{userID, amount}, &out)
	return out, err
}

// Discord reads Discord data the plugin did not get pushed (permission "discord.read").
var Discord discord

type discord struct{}

// Member returns a member of this server, or nil when they are not in it.
func (discord) Member(userID string) (*Member, error) {
	var out struct {
		Member *Member `json:"member"`
	}
	err := Call("discord.member.get", map[string]string{"userId": userID}, &out)
	return out.Member, err
}

// Roles returns this server's roles, highest first.
func (discord) Roles() ([]Role, error) {
	var out struct {
		Roles []Role `json:"roles"`
	}
	err := Call("discord.roles.list", struct{}{}, &out)
	return out.Roles, err
}

// Sent identifies a message the plugin posted, for Messages.Edit and Messages.Delete.
type Sent struct {
	MessageID string `json:"messageId"`
	ChannelID string `json:"channelId"`
}

type located struct {
	Message
	ChannelID string `json:"channelId,omitempty"`
	MessageID string `json:"messageId,omitempty"`
}

// Messages posts and manages messages (permission "messages.send"; Remove needs
// "messages.manage"). When a member triggered the call, they must be allowed to do it too.
var Messages messages

type messages struct{}

// Send posts msg in a channel; channelID "" means the channel of the command, job or event
// (the error code is "no_channel" when there is none, as for levelUp).
func (messages) Send(channelID string, msg Message) (Sent, error) {
	var out Sent
	err := Call("discord.messages.send", located{Message: msg, ChannelID: channelID}, &out)
	return out, err
}

// Edit replaces a message this plugin posted.
func (messages) Edit(channelID, messageID string, msg Message) (Sent, error) {
	var out Sent
	err := Call("discord.messages.edit", located{msg, channelID, messageID}, &out)
	return out, err
}

// Delete deletes a message this plugin posted and reports whether it was still there.
func (messages) Delete(channelID, messageID string) (bool, error) {
	var out struct {
		Deleted bool `json:"deleted"`
	}
	err := Call("discord.messages.delete", map[string]string{"channelId": channelID, "messageId": messageID}, &out)
	return out.Deleted, err
}

// Remove deletes anyone's message, with an optional reason for the audit log.
func (messages) Remove(channelID, messageID, reason string) (bool, error) {
	var out struct {
		Deleted bool `json:"deleted"`
	}
	err := Call("discord.messages.remove", struct {
		ChannelID string `json:"channelId"`
		MessageID string `json:"messageId"`
		Reason    string `json:"reason,omitempty"`
	}{channelID, messageID, reason}, &out)
	return out.Deleted, err
}

// Reactions adds reactions (permission "reactions").
var Reactions reactions

type reactions struct{}

// Add reacts to a message with a unicode emoji or a custom emoji ID.
func (reactions) Add(channelID, messageID, emoji string) error {
	return Call("discord.reactions.add", map[string]string{
		"channelId": channelID, "messageId": messageID, "emoji": emoji,
	}, nil)
}

// DM sends direct messages to members of this server (permission "dm.send"), 5 per member per
// hour; past that the error code is "dm_limit".
var DM dm

type dm struct{}

// Send DMs a member and reports whether it arrived (members can turn DMs off).
func (dm) Send(userID string, msg Message) (bool, error) {
	var out struct {
		Delivered bool `json:"delivered"`
	}
	err := Call("discord.dm.send", struct {
		Message
		UserID string `json:"userId"`
	}{msg, userID}, &out)
	return out.Delivered, err
}

// Thread describes a thread for Threads.Create.
type Thread struct {
	Name string `json:"name"`
	// ChannelID "" means where the command, event or job happened.
	ChannelID string `json:"channelId,omitempty"`
	// MessageID starts the thread from that message.
	MessageID string `json:"messageId,omitempty"`
	Private   bool   `json:"private,omitempty"`
}

// Threads starts threads (permission "threads.create").
var Threads threads

type threads struct{}

// Create starts a thread and returns its ID, which works as a channel ID for Messages.Send.
func (threads) Create(t Thread) (string, error) {
	var out struct {
		ThreadID string `json:"threadId"`
	}
	err := Call("discord.threads.create", t, &out)
	return out.ThreadID, err
}

// Roles gives and takes roles (permission "roles.manage"). Roles with staff permissions need a
// caller with Manage Roles.
var Roles roles

type roles struct{}

type roleChange struct {
	UserID string `json:"userId"`
	RoleID string `json:"roleId"`
	Reason string `json:"reason,omitempty"`
}

// Add gives a member a role and reports whether they lacked it.
func (roles) Add(userID, roleID, reason string) (bool, error) {
	var out struct {
		Changed bool `json:"changed"`
	}
	err := Call("discord.roles.add", roleChange{userID, roleID, reason}, &out)
	return out.Changed, err
}

// Remove takes a role from a member and reports whether they had it.
func (roles) Remove(userID, roleID, reason string) (bool, error) {
	var out struct {
		Changed bool `json:"changed"`
	}
	err := Call("discord.roles.remove", roleChange{userID, roleID, reason}, &out)
	return out.Changed, err
}

// Case is a moderation case from Moderation.History.
type Case struct {
	Number      int64  `json:"number"`
	Action      string `json:"action"`
	Reason      string `json:"reason"`
	ModeratorID string `json:"moderatorId"`
	// DurationSeconds is 0 for actions without a duration.
	DurationSeconds int64     `json:"durationSeconds"`
	CreatedAt       time.Time `json:"createdAt"`
}

// History is a member's cases, newest first, and how many they have in all.
type History struct {
	Total int64  `json:"total"`
	Cases []Case `json:"cases"`
}

// Outcome is the case a moderation action opened, whether the member was told by DM, and the
// case of an automatic escalation it triggered (0 when none).
type Outcome struct {
	Case          int64 `json:"case"`
	Notified      bool  `json:"notified"`
	EscalatedCase int64 `json:"escalatedCase"`
}

// Moderation acts like the bot's own moderation commands: cases, DMs, mod log and escalation
// (permission "moderation.read" for History, "moderation.act" for the rest). When a member
// triggered the call, they are the moderator and need the matching Discord permission; otherwise
// the error code is "caller_forbidden".
var Moderation moderation

type moderation struct{}

type modInput struct {
	UserID string `json:"userId"`
	Reason string `json:"reason,omitempty"`
}

func (moderation) act(name string, input any) (Outcome, error) {
	var out Outcome
	err := Call(name, input, &out)
	return out, err
}

// History returns a member's cases (limit 1 to 25).
func (moderation) History(userID string, limit int) (History, error) {
	var out History
	err := Call("moderation.history", map[string]any{"userId": userID, "limit": limit}, &out)
	return out, err
}

// Warn warns a member; warnings count towards the server's escalation. reason is required.
func (m moderation) Warn(userID, reason string) (Outcome, error) {
	return m.act("moderation.warn", modInput{userID, reason})
}

// Timeout times a member out for 1 minute to 28 days (40320 minutes).
func (m moderation) Timeout(userID string, minutes int, reason string) (Outcome, error) {
	return m.act("moderation.timeout", struct {
		modInput
		Minutes int `json:"minutes"`
	}{modInput{userID, reason}, minutes})
}

// Untimeout lifts a member's timeout.
func (m moderation) Untimeout(userID, reason string) (Outcome, error) {
	return m.act("moderation.untimeout", modInput{userID, reason})
}

// Kick kicks a member.
func (m moderation) Kick(userID, reason string) (Outcome, error) {
	return m.act("moderation.kick", modInput{userID, reason})
}

// Ban bans a user and deletes their messages of the last deleteMessages (up to 7 days). For a
// temporary ban, schedule a job that calls Unban.
func (m moderation) Ban(userID, reason string, deleteMessages time.Duration) (Outcome, error) {
	return m.act("moderation.ban", struct {
		modInput
		DeleteMessageSeconds int `json:"deleteMessageSeconds"`
	}{modInput{userID, reason}, int(deleteMessages / time.Second)})
}

// Unban lifts a ban.
func (m moderation) Unban(userID, reason string) (Outcome, error) {
	return m.act("moderation.unban", modInput{userID, reason})
}

// Run is a pending run from Schedule.List.
type Run struct {
	Key   string    `json:"key"`
	RunAt time.Time `json:"runAt"`
}

// Schedule runs handle_job later, 10 seconds to a year ahead (permission "schedule"). The job
// gets the key and data back, plus the channel it was scheduled from. A server holds up to 100
// pending runs per plugin, and data is at most 2 KB of JSON.
var Schedule schedule

type schedule struct{}

type scheduleInput struct {
	Key     string `json:"key,omitempty"`
	Seconds *int64 `json:"seconds,omitempty"`
	At      string `json:"at,omitempty"`
	Data    any    `json:"data,omitempty"`
}

func (schedule) create(input scheduleInput) (time.Time, error) {
	var out struct {
		RunAt time.Time `json:"runAt"`
	}
	err := Call("schedule.create", input, &out)
	return out.RunAt, err
}

// In runs handle_job after d (whole seconds) and returns when. A non-empty key replaces any
// pending run with the same key and lets Cancel find it; keys are letters, numbers, _ : . or -.
func (s schedule) In(key string, d time.Duration, data any) (time.Time, error) {
	seconds := int64(d / time.Second)
	return s.create(scheduleInput{Key: key, Seconds: &seconds, Data: data})
}

// At runs handle_job at t; key and data work as for In.
func (s schedule) At(key string, t time.Time, data any) (time.Time, error) {
	return s.create(scheduleInput{Key: key, At: t.UTC().Format(time.RFC3339), Data: data})
}

// Cancel drops the pending run with this key and reports whether there was one.
func (schedule) Cancel(key string) (bool, error) {
	var out struct {
		Cancelled bool `json:"cancelled"`
	}
	err := Call("schedule.cancel", map[string]string{"key": key}, &out)
	return out.Cancelled, err
}

// List returns this server's pending runs, soonest first.
func (schedule) List() ([]Run, error) {
	var out struct {
		Runs []Run `json:"runs"`
	}
	err := Call("schedule.list", struct{}{}, &out)
	return out.Runs, err
}
