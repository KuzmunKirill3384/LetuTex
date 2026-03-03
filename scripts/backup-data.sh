#!/usr/bin/env bash
# Backup data/ (projects, users). Usage: ./scripts/backup-data.sh [out-dir]
# Cron example: 0 2 * * * /path/to/LetuTEX/scripts/backup-data.sh /var/backups/letutex

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="${DATA_DIR:-$ROOT/data}"
OUT="${1:-$ROOT/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
tar -czf "$OUT/data-$STAMP.tar.gz" -C "$ROOT" data 2>/dev/null || true
echo "Backup: $OUT/data-$STAMP.tar.gz"
