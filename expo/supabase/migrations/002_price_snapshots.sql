-- Таблица для хранения последних известных цен на металл по городу.
-- Идемпотентная миграция: безопасно выполнять повторно.
-- Запустить в Supabase SQL Editor проекта.

create table if not exists public.price_snapshots (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  metal_name text not null,
  current_price numeric not null,
  previous_price numeric,
  direction text not null default 'same' check (direction in ('increase', 'decrease', 'same')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists price_snapshots_city_metal_uidx
  on public.price_snapshots (city, metal_name);

create index if not exists price_snapshots_city_idx on public.price_snapshots (city);

-- Автообновление updated_at (функция из 001)
drop trigger if exists price_snapshots_set_updated_at on public.price_snapshots;
create trigger price_snapshots_set_updated_at
  before update on public.price_snapshots
  for each row execute function public.set_updated_at();

-- RLS: чтение разрешено anon, запись — только service_role (cron/edge function)
alter table public.price_snapshots enable row level security;

drop policy if exists "anon select price_snapshots" on public.price_snapshots;
create policy "anon select price_snapshots"
  on public.price_snapshots for select
  to anon
  using (true);

-- Для service_role политики не нужны: он обходит RLS.
