# Edge Function: `check-prices`

Автоматическая проверка цен на металл и отправка push-уведомлений при реальном изменении цены.

## Что делает

1. Тянет актуальные цены из публичного API приложения (`PRICES_API_URL`, по умолчанию `https://промметпласт.рф/wp-json/metals/v1/prices`).
2. Сравнивает с таблицей `price_snapshots` по каждой паре `(city, metal_name)`.
3. Если цена выросла → отправляет push в Expo пользователям с `price_increase = true` для этого города.
4. Если цена снизилась → отправляет push пользователям с `price_decrease = true`.
5. Если цена не изменилась — push не отправляется.
6. При первом сохранении цен для города (снапшотов ещё нет) — push не отправляется, только сохраняются снапшоты.
7. После проверки таблица `price_snapshots` обновляется.
8. Невалидные токены (`DeviceNotRegistered`) удаляются из `push_tokens`.

Соответствие App Store Guideline 5.1.1: push идёт только тем пользователям, кто явно включил соответствующий toggle.

## Предварительные миграции

Перед деплоем убедитесь, что в Supabase применены:

- `expo/supabase/migrations/001_push_tokens.sql`
- `expo/supabase/migrations/002_price_snapshots.sql`

## Деплой

Установить Supabase CLI: <https://supabase.com/docs/guides/cli>

```bash
# 1. Авторизация и линковка проекта (один раз)
supabase login
supabase link --project-ref ihdnzusoorcimswnibuo

# 2. Деплой функции (из корня репозитория)
supabase functions deploy check-prices \
  --no-verify-jwt \
  --project-ref ihdnzusoorcimswnibuo \
  --workdir expo
```

`SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` Edge Function получает автоматически.
При необходимости задайте `PRICES_API_URL`:

```bash
supabase secrets set PRICES_API_URL="https://your-api.example.com/prices" --project-ref ihdnzusoorcimswnibuo
```

## Запуск вручную

```bash
curl -X POST \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  https://ihdnzusoorcimswnibuo.supabase.co/functions/v1/check-prices
```

Ответ:

```json
{
  "ok": true,
  "durationMs": 1234,
  "cities": [
    { "city": "novosibirsk", "total": 18, "changes": 2, "isFirstRun": false, "pushedIncrease": 42, "pushedDecrease": 0 }
  ]
}
```

## Cron каждые 30 минут (pg_cron + pg_net)

В Supabase SQL Editor выполнить один раз:

```sql
-- Включить расширения (если ещё не включены)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Сохранить service_role ключ в безопасном месте (Vault)
-- ВАЖНО: НЕ кладите service_role в публичные настройки. Используйте Supabase Vault:
select vault.create_secret(
  '<SUPABASE_SERVICE_ROLE_KEY>',
  'service_role_key'
);

-- Запланировать вызов каждые 30 минут
select cron.schedule(
  'check-prices-every-30m',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://ihdnzusoorcimswnibuo.supabase.co/functions/v1/check-prices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Проверить расписание
select * from cron.job;

-- Отключить при необходимости
-- select cron.unschedule('check-prices-every-30m');
```

## Логи

```bash
supabase functions logs check-prices --project-ref ihdnzusoorcimswnibuo
```

## Локальный запуск

```bash
supabase functions serve check-prices --no-verify-jwt --env-file ./expo/supabase/.env.local
curl -X POST http://localhost:54321/functions/v1/check-prices
```
