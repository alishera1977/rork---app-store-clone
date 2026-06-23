#!/usr/bin/env python3
"""Run all Supabase migrations via the Management API."""
import os
import sys
import json
import urllib.request

ACCESS_TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
PROJECT_REF = "ihdnzusoorcimswnibuo"
API_BASE = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"

if not ACCESS_TOKEN:
    print("ERROR: SUPABASE_ACCESS_TOKEN not set")
    sys.exit(1)

def run_sql(query: str, label: str = "") -> bool:
    """Run a single SQL statement via the Management API."""
    body = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(
        API_BASE,
        data=body,
        headers={
            "Authorization": f"Bearer {ACCESS_TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            result = resp.read().decode("utf-8")
            status = resp.status
    except urllib.error.HTTPError as e:
        result = e.read().decode("utf-8")
        status = e.code

    if status >= 400:
        print(f"  FAIL [{label}]: {result[:300]}")
        return False
    else:
        print(f"  OK   [{label}]")
        return True


# ============================================================
# Migration 001: push_tokens
# ============================================================
print("\n--- Migration 001: push_tokens ---")

run_sql(
    """create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  city text,
  created_at timestamptz not null default now()
)""",
    "001: push_tokens table"
)

for col in [
    "price_increase boolean not null default true",
    "price_decrease boolean not null default true",
    "request_status boolean not null default true",
    "company_news boolean not null default true",
    "updated_at timestamptz not null default now()",
]:
    run_sql(f"alter table public.push_tokens add column if not exists {col}", f"001: add {col.split()[0]}")

run_sql(
    """create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$""",
    "001: set_updated_at function"
)

for idx_col in ["city", "price_increase", "price_decrease", "request_status", "company_news"]:
    run_sql(
        f"create index if not exists push_tokens_{idx_col}_idx on public.push_tokens ({idx_col})",
        f"001: {idx_col} index"
    )

run_sql("drop trigger if exists push_tokens_set_updated_at on public.push_tokens", "001: drop trigger")
run_sql(
    "create trigger push_tokens_set_updated_at before update on public.push_tokens for each row execute function public.set_updated_at()",
    "001: create trigger"
)

run_sql("alter table public.push_tokens enable row level security", "001: enable RLS")

policies = [
    ("anon insert push_tokens", "for insert to anon with check (true)"),
    ("anon update push_tokens", "for update to anon using (true) with check (true)"),
    ("anon select push_tokens", "for select to anon using (true)"),
    ("anon delete push_tokens", "for delete to anon using (true)"),
]
for name, clause in policies:
    run_sql(f'drop policy if exists "{name}" on public.push_tokens', f"001: drop {name}")
    run_sql(f'create policy "{name}" on public.push_tokens {clause}', f"001: create {name}")


# ============================================================
# Migration 002: price_snapshots
# ============================================================
print("\n--- Migration 002: price_snapshots ---")

run_sql(
    """create table if not exists public.price_snapshots (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  metal_name text not null,
  current_price numeric not null,
  previous_price numeric,
  direction text not null default 'same' check (direction in ('increase', 'decrease', 'same')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)""",
    "002: price_snapshots table"
)

run_sql(
    "create unique index if not exists price_snapshots_city_metal_uidx on public.price_snapshots (city, metal_name)",
    "002: unique index"
)
run_sql(
    "create index if not exists price_snapshots_city_idx on public.price_snapshots (city)",
    "002: city index"
)

run_sql("drop trigger if exists price_snapshots_set_updated_at on public.price_snapshots", "002: drop trigger")
run_sql(
    "create trigger price_snapshots_set_updated_at before update on public.price_snapshots for each row execute function public.set_updated_at()",
    "002: create trigger"
)

run_sql("alter table public.price_snapshots enable row level security", "002: enable RLS")
run_sql(
    'drop policy if exists "anon select price_snapshots" on public.price_snapshots',
    "002: drop policy"
)
run_sql(
    'create policy "anon select price_snapshots" on public.price_snapshots for select to anon using (true)',
    "002: create policy"
)


# ============================================================
# Migration 003: price_history + smart_price_notifications
# ============================================================
print("\n--- Migration 003: smart notifications ---")

run_sql(
    """create table if not exists public.price_history (
  id bigint primary key generated always as identity,
  city text not null,
  metal_name text not null,
  category text not null check (category in ('ferrous', 'non-ferrous')),
  current_price numeric not null check (current_price > 0),
  previous_price numeric,
  price_diff numeric,
  percent_diff numeric,
  date date not null,
  created_at timestamptz not null default now()
)""",
    "003: price_history table"
)

run_sql(
    "create unique index if not exists price_history_city_metal_date_uidx on public.price_history (city, metal_name, date)",
    "003: price_history unique index"
)
run_sql(
    "create index if not exists price_history_city_date_idx on public.price_history (city, date)",
    "003: price_history city_date index"
)
run_sql(
    "create index if not exists price_history_date_idx on public.price_history (date)",
    "003: price_history date index"
)

run_sql(
    """create table if not exists public.smart_price_notifications (
  id bigint primary key generated always as identity,
  city text not null,
  metal_name text not null,
  date date not null,
  title text not null,
  body text not null,
  score numeric,
  sent_at timestamptz not null default now()
)""",
    "003: smart_price_notifications table"
)

run_sql(
    "create unique index if not exists smart_notif_city_date_uidx on public.smart_price_notifications (city, date)",
    "003: smart_notif unique index"
)
run_sql(
    "create index if not exists smart_notif_date_idx on public.smart_price_notifications (date)",
    "003: smart_notif date index"
)

# RLS for price_history
run_sql("alter table public.price_history enable row level security", "003: price_history RLS")
run_sql(
    'drop policy if exists "anon select price_history" on public.price_history',
    "003: drop price_history policy"
)
run_sql(
    'create policy "anon select price_history" on public.price_history for select to anon using (true)',
    "003: create price_history policy"
)

# RLS for smart_price_notifications
run_sql("alter table public.smart_price_notifications enable row level security", "003: smart_notif RLS")
run_sql(
    'drop policy if exists "anon select smart_price_notifications" on public.smart_price_notifications',
    "003: drop smart_notif policy"
)
run_sql(
    'create policy "anon select smart_price_notifications" on public.smart_price_notifications for select to anon using (true)',
    "003: create smart_notif policy"
)

print("\n=== All migrations complete ===")
