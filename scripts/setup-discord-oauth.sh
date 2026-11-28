#!/bin/sh
# Asks for the Discord app's Client Secret and writes it to .env. The Client ID is the bot's own.
# Usage: sh scripts/setup-discord-oauth.sh [.env file]
set -eu

env_file=${1:-.env}

[ -f "$env_file" ] || { echo "no $env_file here — run this from the roboteco folder"; exit 1; }
grep -q '^PANEL_URL=' "$env_file" || { echo "$env_file has no PANEL_URL — this is not the panel repo"; exit 1; }
grep -q '^DISCORD_CLIENT_ID=.' "$env_file" || { echo "$env_file has no DISCORD_CLIENT_ID — fill it in first"; exit 1; }

printf 'DISCORD_CLIENT_SECRET (not echoed): '
hidden=no
if [ -t 0 ]; then stty -echo; hidden=yes; fi
trap '[ "$hidden" = yes ] && stty echo' EXIT INT TERM
IFS= read -r sec
if [ "$hidden" = yes ]; then stty echo; hidden=no; fi
printf '\n'

[ -n "$sec" ] || { echo "the secret is required"; exit 1; }

# awk instead of sed: '&', '/', '%' inside the secret must stay literal.
SEC="$sec" awk '
  BEGIN { sec = ENVIRON["SEC"]; got = 0 }
  /^DISCORD_CLIENT_SECRET=/ { print "DISCORD_CLIENT_SECRET=" sec; got = 1; next }
  { print }
  END { if (!got) print "DISCORD_CLIENT_SECRET=" sec }
' "$env_file" > "$env_file.tmp"
mv "$env_file.tmp" "$env_file"
chmod 600 "$env_file"

url=$(grep -m1 '^PANEL_URL=' "$env_file" | cut -d= -f2- | tr -d '\r' | sed 's:/*$::')
allow=$(grep -m1 '^PANEL_ALLOWED_EMAILS=' "$env_file" | cut -d= -f2- || true)

printf '\n.env written\n'
printf 'redirect URI for Discord: %s/api/auth/callback/discord\n' "$url"
if [ -n "${allow:-}" ]; then
  printf 'allowed emails: %s\n' "$allow"
else
  printf 'allowed emails: <EMPTY — nobody gets in>\n'
fi
printf '\nrestart the bot and check: curl -s localhost:4321/api/panel/auth/status\n'
