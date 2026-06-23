#!/bin/bash
# Run Supabase migrations via Management API
set -e

ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN}"
PROJECT_REF="ihdnzusoorcimswnibuo"
API="https://api.supabase.com/v1/projects/$PROJECT_REF/database/query"

if [ -z "$ACCESS_TOKEN" ]; then
  echo "ERROR: SUPABASE_ACCESS_TOKEN not set"
  exit 1
fi

run_sql() {
  local query="$1"
  local label="$2"
  local resp
  resp=$(curl -s -X POST \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    "$API" \
    -d "$(python3 -c "import json,sys; print(json.dumps({'query':sys.argv[1]}))" "$query")" 2>&1)
  
  if echo "$resp" | grep -q '"message"'; then
    echo "  FAIL [$label]: $(echo "$resp" | head -c 200)"
    return 1
  else
    echo "  OK   [$label]"
    return 0
  fi
}

FAILS=0

echo ""
echo "========================================="
echo "Migration 001: push_tokens"
echo "========================================="

run_sql "create table if not exists public.push_tokens (id uuid primary key default gen_random_uuid(), token text not null unique, platform text not null check (platform in ('ios','android')), city text, created_at timestamptz not null default now())" "001: push_tokens table" || ((FAILS++))

run_sql "alter table public.push_tokens add column if not exists price_increase boolean not null default true" "001: price_increase col" || ((FAILS++))
run_sql "alter table public.push_tokens add column if not exists price_decrease boolean not null default true" "001: price_decrease col" || ((FAILS++))
run_sql "alter table public.push_tokens add column if not exists request_status boolean not null default true" "001: request_status col" || ((FAILS++))
run_sql "alter table public.push_tokens add column if not exists company_news boolean not null default true" "001: company_news col" || ((FAILS++))
run_sql "alter table public.push_tokens add column if not exists updated_at timestamptz not null default now()" "001: updated_at col" || ((FAILS++))

run_sql "create or replace function public.set_updated_at() returns trigger language plpgsql as \$\$ begin new.updated_at = now(); return new; end; \$\$" "001: set_updated_at fn" || ((FAILS++))

for col in city price_increase price_decrease request_status company_news; do
  run_sql "create index if not exists push_tokens_${col}_idx on public.push_tokens (${col})" "001: ${col} index" || ((FAILS++))
done

run_sql "drop trigger if exists push_tokens_set_updated_at on public.push_tokens" "001: drop trigger" || ((FAILS++))
run_sql "create trigger push_tokens_set_updated_at before update on public.push_tokens for each row execute function public.set_updated_at()" "001: create trigger" || ((FAILS++))

run_sql "alter table public.push_tokens enable row level security" "001: enable RLS" || ((FAILS++))

for pol in "anon insert push_tokens:for insert to anon with check (true)" "anon update push_tokens:for update to anon using (true) with check (true)" "anon select push_tokens:for select to anon using (true)" "anon delete push_tokens:for delete to anon using (true)"; do
  name="${pol%%:*}"
  clause="${pol#*:}"
  run_sql "drop policy if exists \"${name}\" on public.push_tokens" "001: drop ${name}" || ((FAILS++))
  run_sql "create policy \"${name}\" on public.push_tokens ${clause}" "001: create ${name}" || ((FAILS++))
done

echo ""
echo "========================================="
echo "Migration 002: price_snapshots"
echo "========================================="

run_sql "create table if not exists public.price_snapshots (id uuid primary key default gen_random_uuid(), city text not null, metal_name text not null, current_price numeric not null, previous_price numeric, direction text not null default 'same' check (direction in ('increase','decrease','same')), created_at timestamptz not null default now(), updated_at timestamptz not null default now())" "002: table" || ((FAILS++))

run_sql "create unique index if not exists price_snapshots_city_metal_uidx on public.price_snapshots (city, metal_name)" "002: unique index" || ((FAILS++))
run_sql "create index if not exists price_snapshots_city_idx on public.price_snapshots (city)" "002: city index" || ((FAILS++))

run_sql "drop trigger if exists price_snapshots_set_updated_at on public.price_snapshots" "002: drop trigger" || ((FAILS++))
run_sql "create trigger price_snapshots_set_updated_at before update on public.price_snapshots for each row execute function public.set_updated_at()" "002: create trigger" || ((FAILS++))

run_sql "alter table public.price_snapshots enable row level security" "002: enable RLS" || ((FAILS++))
run_sql "drop policy if exists \"anon select price_snapshots\" on public.price_snapshots" "002: drop policy" || ((FAILS++))
run_sql "create policy \"anon select price_snapshots\" on public.price_snapshots for select to anon using (true)" "002: create policy" || ((FAILS++))

echo ""
echo "========================================="
echo "Migration 003: smart notifications"
echo "========================================="

run_sql "create table if not exists public.price_history (id bigint primary key generated always as identity, city text not null, metal_name text not null, category text not null check (category in ('ferrous','non-ferrous')), current_price numeric not null check (current_price > 0), previous_price numeric, price_diff numeric, percent_diff numeric, date date not null, created_at timestamptz not null default now())" "003: price_history table" || ((FAILS++))

run_sql "create unique index if not exists price_history_city_metal_date_uidx on public.price_history (city, metal_name, date)" "003: ph unique index" || ((FAILS++))
run_sql "create index if not exists price_history_city_date_idx on public.price_history (city, date)" "003: ph city_date index" || ((FAILS++))
run_sql "create index if not exists price_history_date_idx on public.price_history (date)" "003: ph date index" || ((FAILS++))

run_sql "create table if not exists public.smart_price_notifications (id bigint primary key generated always as identity, city text not null, metal_name text not null, date date not null, title text not null, body text not null, score numeric, sent_at timestamptz not null default now())" "003: smart_notif table" || ((FAILS++))

run_sql "create unique index if not exists smart_notif_city_date_uidx on public.smart_price_notifications (city, date)" "003: sn unique index" || ((FAILS++))
run_sql "create index if not exists smart_notif_date_idx on public.smart_price_notifications (date)" "003: sn date index" || ((FAILS++))

run_sql "alter table public.price_history enable row level security" "003: ph RLS" || ((FAILS++))
run_sql "drop policy if exists \"anon select price_history\" on public.price_history" "003: ph drop policy" || ((FAILS++))
run_sql "create policy \"anon select price_history\" on public.price_history for select to anon using (true)" "003: ph create policy" || ((FAILS++))

run_sql "alter table public.smart_price_notifications enable row level security" "003: sn RLS" || ((FAILS++))
run_sql "drop policy if exists \"anon select smart_price_notifications\" on public.smart_price_notifications" "003: sn drop policy" || ((FAILS++))
run_sql "create policy \"anon select smart_price_notifications\" on public.smart_price_notifications for select to anon using (true)" "003: sn create policy" || ((FAILS++))

echo ""
echo "========================================="
echo "Done: $FAILS failures"
echo "========================================="
