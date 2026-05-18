-- Таблица для хранения Expo Push Tokens и пользовательских настроек.
-- Идемпотентная миграция: безопасно выполнять повторно.
-- Запустить в Supabase SQL Editor проекта.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  city text,
  created_at timestamptz not null default now()
);

-- Догоняющие колонки (на случай, если таблица была создана раньше без них).
alter table public.push_tokens add column if not exists price_increase boolean not null default true;
alter table public.push_tokens add column if not exists price_decrease boolean not null default true;
alter table public.push_tokens add column if not exists request_status boolean not null default true;
alter table public.push_tokens add column if not exists company_news boolean not null default true;
alter table public.push_tokens add column if not exists updated_at timestamptz not null default now();

create index if not exists push_tokens_city_idx on public.push_tokens (city);
create index if not exists push_tokens_price_increase_idx on public.push_tokens (price_increase);
create index if not exists push_tokens_price_decrease_idx on public.push_tokens (price_decrease);
create index if not exists push_tokens_request_status_idx on public.push_tokens (request_status);
create index if not exists push_tokens_company_news_idx on public.push_tokens (company_news);

-- Автообновление updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists push_tokens_set_updated_at on public.push_tokens;
create trigger push_tokens_set_updated_at
  before update on public.push_tokens
  for each row execute function public.set_updated_at();

-- Row Level Security: разрешаем anon клиенту upsert/select/delete своего токена.
-- Рассылку push выполняем с service_role (на сервере), который RLS обходит.
alter table public.push_tokens enable row level security;

drop policy if exists "anon insert push_tokens" on public.push_tokens;
create policy "anon insert push_tokens"
  on public.push_tokens for insert
  to anon
  with check (true);

drop policy if exists "anon update push_tokens" on public.push_tokens;
create policy "anon update push_tokens"
  on public.push_tokens for update
  to anon
  using (true)
  with check (true);

drop policy if exists "anon select push_tokens" on public.push_tokens;
create policy "anon select push_tokens"
  on public.push_tokens for select
  to anon
  using (true);

drop policy if exists "anon delete push_tokens" on public.push_tokens;
create policy "anon delete push_tokens"
  on public.push_tokens for delete
  to anon
  using (true);
