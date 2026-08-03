#!/usr/bin/env bash
# Applies every migration in db/migrations/ in order against $DATABASE_URL.
# See db/migrations/README.md for manual/Docker alternatives.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Example:" >&2
  echo '  export DATABASE_URL=postgresql://antech:antech_dev_password@localhost:5432/antech_erp' >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for f in "$SCRIPT_DIR"/*.sql; do
  echo "Applying $(basename "$f")..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "All migrations applied."
