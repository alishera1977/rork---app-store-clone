-- price_history: ежедневная история цен по каждому металлу в каждом городе.
-- По одной строке за (city, metal_name, date).
create table if not exists public.price_history (
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
);

create unique index if not exists price_history_city_metal_date_uidx
  on public.price_history (city, metal_name, date);

create index if not exists price_history_city_date_idx
  on public.price_history (city, date);

create index if not exists price_history_date_idx
  on public.price_history (date);

-- smart_price_notifications: журнал отправленных «умных» уведомлений.
-- По одному на город в день.
create table if not exists public.smart_price_notifications (
  id bigint primary key generated always as identity,
  city text not null,
  metal_name text not null,
  date date not null,
  title text not null,
  body text not null,
  score numeric,
  sent_at timestamptz not null default now()
);

create unique index if not exists smart_notif_city_date_uidx
  on public.smart_price_notifications (city, date);

create index if not exists smart_notif_date_idx
  on public.smart_price_notifications (date);

-- RLS: разрешаем анонимному клиенту читать обе таблицы.
alter table public.price_history enable row level security;
alter table public.smart_price_notifications enable row level security;

drop policy if exists "anon select price_history" on public.price_history;
create policy "anon select price_history"
  on public.price_history for select
  to anon
  using (true);

drop policy if exists "anon select smart_price_notifications" on public.smart_price_notifications;
create policy "anon select smart_price_notifications"
  on public.smart_price_notifications for select
  to anon
  using (true);
