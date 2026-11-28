// Command remind shows events, scheduled jobs and Discord actions: /nudge, a 🏓 on "ping",
// and a congratulation on level ups.
package main

import (
	"fmt"
	"time"

	"roboteco.dev/sdk"
)

//go:wasmexport manifest
func manifest() int32 {
	return roboteco.Manifest(roboteco.Plugin{
		Name:    "remind",
		Version: "1.0.0",
		Uses: []string{
			"schedule.create", "discord.messages.send", "discord.reactions.add",
			"kv.get", "kv.set", "kv.increment",
		},
		Events: []string{roboteco.EventMessageCreate, roboteco.EventLevelUp},
		Commands: []roboteco.CommandSpec{
			{
				Name:                     "nudge",
				Description:              "Remind you of something later",
				NameLocalizations:        roboteco.Localized{"pt-BR": "cutucar"},
				DescriptionLocalizations: roboteco.Localized{"pt-BR": "Te lembra de algo mais tarde"},
				Options: []roboteco.OptionSpec{
					{
						Type: "integer", Name: "in", Description: "In how many minutes", Required: true,
						NameLocalizations:        roboteco.Localized{"pt-BR": "em"},
						DescriptionLocalizations: roboteco.Localized{"pt-BR": "Daqui a quantos minutos"},
						MinValue:                 roboteco.Ptr(1.0), MaxValue: roboteco.Ptr(10080.0),
					},
					{
						Type: "string", Name: "text", Description: "What to remind you of", Required: true,
						NameLocalizations:        roboteco.Localized{"pt-BR": "texto"},
						DescriptionLocalizations: roboteco.Localized{"pt-BR": "Do que lembrar"},
						MaxLength:                1000,
					},
				},
			},
			{
				Name:                     "levelup-channel",
				Description:              "Where to congratulate members who level up",
				DescriptionLocalizations: roboteco.Localized{"pt-BR": "Onde parabenizar quem sobe de nível"},
				DefaultPermissions:       []string{"ManageGuild"},
				Options: []roboteco.OptionSpec{{
					Type: "channel", Name: "channel", Description: "The channel", Required: true,
					NameLocalizations:        roboteco.Localized{"pt-BR": "canal"},
					DescriptionLocalizations: roboteco.Localized{"pt-BR": "O canal"},
				}},
			},
		},
	})
}

type reminder struct {
	ChannelID string `json:"channelId"`
	UserID    string `json:"userId"`
	Text      string `json:"text"`
}

//go:wasmexport handle_command
func handleCommand() int32 { return roboteco.HandleCommand(run) }

func run(cmd roboteco.Command) (roboteco.Response, error) {
	if cmd.Command == "levelup-channel" {
		if !cmd.Can("ManageGuild") {
			return roboteco.Private("You need Manage Server to change this."), nil
		}
		channel := cmd.String("channel")
		if err := roboteco.KV.Set("levelup-channel", channel); err != nil {
			return roboteco.Response{}, err
		}
		return roboteco.Private(fmt.Sprintf("Level ups will be announced in <#%s>.", channel)), nil
	}
	n, err := roboteco.KV.Increment("reminders:"+cmd.UserID, 1)
	if err != nil {
		return roboteco.Response{}, err
	}
	data := reminder{ChannelID: cmd.ChannelID, UserID: cmd.UserID, Text: cmd.String("text")}
	key := fmt.Sprintf("remind:%s:%d", cmd.UserID, n)
	at, err := roboteco.Schedule.In(key, time.Duration(cmd.Int("in"))*time.Minute, data)
	if err != nil {
		return roboteco.Response{}, err
	}
	return roboteco.Private(fmt.Sprintf("⏰ I'll remind you <t:%d:R>.", at.Unix())), nil
}

//go:wasmexport handle_job
func handleJob() int32 {
	return roboteco.HandleJob(func(job roboteco.Job) error {
		var r reminder
		if err := job.Decode(&r); err != nil {
			return err
		}
		_, err := roboteco.Messages.Send(r.ChannelID, roboteco.Text(fmt.Sprintf("⏰ <@%s>, you asked me to remind you: %s", r.UserID, r.Text)))
		return err
	})
}

//go:wasmexport handle_event
func handleEvent() int32 {
	return roboteco.HandleEvent(func(ev roboteco.Event) error {
		if m := ev.MessageCreate(); m != nil && m.Message.Content == "ping" {
			return roboteco.Reactions.Add(m.Message.ChannelID, m.Message.ID, "🏓")
		}
		if up := ev.LevelUp(); up != nil {
			channel, ok, err := roboteco.KV.Get("levelup-channel")
			if err != nil || !ok {
				return err
			}
			congrats := roboteco.Embed{
				Title:       "🎉 Level up!",
				Description: fmt.Sprintf("<@%s> reached level **%d**.", up.UserID, up.Level),
				Color:       0x57F287,
			}.WithFooter(fmt.Sprintf("%d XP", up.XP))
			_, err = roboteco.Messages.Send(channel, roboteco.Message{Embeds: []roboteco.Embed{congrats}})
			return err
		}
		return nil
	})
}

func main() {}
