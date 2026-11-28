#!/bin/sh
# Pede o Client ID e o Secret do Google e grava no .env.
# Uso: sh scripts/setup-google-oauth.sh [arquivo .env]
set -eu

env_file=${1:-.env}

[ -f "$env_file" ] || { echo "sem $env_file aqui — entre na pasta do roboteco"; exit 1; }
grep -q '^PANEL_URL=' "$env_file" || { echo "$env_file não tem PANEL_URL — este não é o repo do painel"; exit 1; }

printf 'GOOGLE_CLIENT_ID: '
IFS= read -r cid

printf 'GOOGLE_CLIENT_SECRET (não aparece): '
hidden=no
if [ -t 0 ]; then stty -echo; hidden=yes; fi
trap '[ "$hidden" = yes ] && stty echo' EXIT INT TERM
IFS= read -r sec
if [ "$hidden" = yes ]; then stty echo; hidden=no; fi
printf '\n'

[ -n "$cid" ] && [ -n "$sec" ] || { echo "os dois são obrigatórios"; exit 1; }

# awk em vez de sed: '&', '/', '%' no secret entram literais.
CID="$cid" SEC="$sec" awk '
  BEGIN { cid = ENVIRON["CID"]; sec = ENVIRON["SEC"]; got_i = 0; got_s = 0 }
  /^GOOGLE_CLIENT_ID=/     { print "GOOGLE_CLIENT_ID=" cid;     got_i = 1; next }
  /^GOOGLE_CLIENT_SECRET=/ { print "GOOGLE_CLIENT_SECRET=" sec; got_s = 1; next }
  { print }
  END {
    if (!got_i) print "GOOGLE_CLIENT_ID=" cid
    if (!got_s) print "GOOGLE_CLIENT_SECRET=" sec
  }
' "$env_file" > "$env_file.tmp"
mv "$env_file.tmp" "$env_file"
chmod 600 "$env_file"

url=$(grep -m1 '^PANEL_URL=' "$env_file" | cut -d= -f2- | tr -d '\r' | sed 's:/*$::')
allow=$(grep -m1 '^PANEL_ALLOWED_EMAILS=' "$env_file" | cut -d= -f2- || true)

printf '\n.env gravado\n'
printf 'redirect URI no Google: %s/api/auth/callback/google\n' "$url"
if [ -n "${allow:-}" ]; then
  printf 'emails liberados: %s\n' "$allow"
else
  printf 'emails liberados: <VAZIO — ninguém entra>\n'
fi
printf '\nreinicia o bot e confere: curl -s localhost:4321/api/panel/auth/status\n'
