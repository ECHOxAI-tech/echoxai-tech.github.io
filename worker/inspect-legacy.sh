#!/bin/sh
# Aggregate-only look at the legacy tdh-stats database: counts, date range, per-tool totals. No row contents are printed.
cd "$(dirname "$0")" || exit 1
q() { echo "-- $1"; npx -y wrangler@latest d1 execute tdh-stats --remote --command "$1" 2>/dev/null | grep -v '^$'; }
q "SELECT count(*) AS rows_total, min(created) AS first, max(created) AS last, sum(gender<>'') AS with_gender, sum(age<>'') AS with_age FROM results"
q "SELECT tool, count(*) AS n, count(DISTINCT data) AS distinct_payloads FROM results GROUP BY tool"
q "SELECT strftime('%Y-%m-%d', created/1000, 'unixepoch') AS day, count(*) AS n FROM results GROUP BY day ORDER BY day"
q "SELECT count(*) AS profiles, count(DISTINCT code) AS codes, min(created) AS first, max(created) AS last FROM profiles"
q "SELECT tool, count(*) AS n FROM profiles GROUP BY tool"
