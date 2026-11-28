#!/bin/sh
# Pede o Client Secret do app do Discord e grava no .env. O Client ID é o do bot.
# Uso: sh scripts/setup-discord-oauth.sh [arquivo .env]
set -eu

env_file=${1:-.env}

[ -f "$env_file" ] || { echo "sem $env_file aqui — entre na pasta do roboteco"; exit 1; }
grep -q '^PANEL_URL=' "$env_file" || { echo "$env_file não tem PANEL_URL — este não é o repo do painel"; exit 1; }
grep -q '^DISCORD_CLIENT_ID=.' "$env_file" || { echo "$env_file não tem DISCORD_CLIENT_ID — preenche primeiro"; exit 1; }

printf 'DISCORD_CLIENT_SECRET (não aparece): '
hidden=no
if [ -t 0 ]; then stty -echo; hidden=yes; fi
trap '[ "$hidden" = yes ] && stty echo' EXIT INT TERM
IFS= read -r sec
if [ "$hidden" = yes ]; then stty echo; hidden=no; fi
printf '\n'

[ -n "$sec" ] || { echo "o secret é obrigatório"; exit 1; }

# awk em vez de sed: '&', '/', '%' no secret entram literais.
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

printf '\n.env gravado\n'
printf 'redirect URI no Discord: %s/api/auth/callback/discord\n' "$url"
if [ -n "${allow:-}" ]; then
  printf 'emails liberados: %s\n' "$allow"
else
  printf 'emails liberados: <VAZIO — ninguém entra>\n'
fi
printf '\nreinicia o bot e confere: curl -s localhost:4321/api/panel/auth/status\n'
