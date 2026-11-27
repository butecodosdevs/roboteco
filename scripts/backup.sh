#!/bin/sh
set -eu

interval=$(( ${BACKUP_INTERVAL_HOURS:-24} * 3600 ))
retention=${BACKUP_RETENTION_DAYS:-14}
mkdir -p /backups

while true; do
  file="/backups/roboteco-$(date -u +%Y%m%dT%H%M%SZ).dump"
  if pg_dump --format=custom --file="$file.partial"; then
    mv "$file.partial" "$file"
    echo "Backup written: $file"
  else
    rm -f "$file.partial"
    echo "Backup failed" >&2
  fi
  find /backups -name 'roboteco-*.dump' -mtime +"$retention" -delete
  sleep "$interval"
done
