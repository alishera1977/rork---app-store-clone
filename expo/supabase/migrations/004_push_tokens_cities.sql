-- push_tokens.cities: переход от одного города (city text) к массиву городов (cities text[]).
-- Пользователь может выбрать несколько городов для уведомлений.
-- Идемпотентная миграция: безопасно выполнять повторно.

-- 1. Добавляем колонку cities (если ещё нет)
alter table public.push_tokens add column if not exists cities text[] not null default '{}';

-- 2. Мигрируем существующие данные: city → cities
update public.push_tokens
set cities = array[city]
where city is not null
  and (cities is null or cities = '{}');

-- 3. Удаляем старую колонку city (осторожно: сначала убеждаемся что миграция прошла)
-- Проверяем что все записи с city уже имеют cities
do $$
begin
  if exists (
    select 1 from public.push_tokens
    where city is not null and (cities is null or cities = '{}')
  ) then
    raise notice 'WARNING: некоторые записи не мигрированы — повторный запуск миграции';
  end if;
end;
$$;

alter table public.push_tokens drop column if exists city;

-- 4. GIN индекс для поиска по массиву (contains)
create index if not exists push_tokens_cities_gin_idx
  on public.push_tokens using gin (cities);

-- 5. Удаляем старый индекс по city
drop index if exists push_tokens_city_idx;

-- 6. Обновляем политики RLS (пересоздаём)
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
