#!/bin/sh
# Garage needs a cluster layout, an access key and a bucket before it accepts S3 requests.
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

KEY_ID="${S3_ACCESS_KEY_ID:-GKe0eaf809415eba6c4491e65b}"
SECRET="${S3_SECRET_ACCESS_KEY:-f35c5ac8cf98fe2bcf4605b8b776d1635f2e5b7e9adf815424e291efcde6b3be}"
BUCKET="${S3_BUCKET:-roboteco}"

garage() {
  docker compose exec -T garage /garage "$@" 2>/dev/null
}

if garage status | grep -q 'NO ROLE ASSIGNED'; then
  NODE_ID="$(garage node id -q | cut -d@ -f1)"
  garage layout assign -z dc1 -c 1G "$NODE_ID" >/dev/null
  garage layout apply --version "$(($(garage layout show | sed -n 's/.*Current cluster layout version: \([0-9]*\).*/\1/p') + 1))" >/dev/null
fi

garage key info "$KEY_ID" >/dev/null || garage key import --yes -n roboteco "$KEY_ID" "$SECRET" >/dev/null
garage bucket info "$BUCKET" >/dev/null || garage bucket create "$BUCKET" >/dev/null
garage bucket allow --read --write --owner "$BUCKET" --key "$KEY_ID" >/dev/null

echo "Garage ready: bucket '$BUCKET', key '$KEY_ID'."
