// Supabase Edge Function: check-prices
//
// Назначение:
//   1. Загружает актуальные цены из публичного API приложения.
//   2. Сравнивает их со снапшотами в таблице `price_snapshots`.
//   3. Отправляет push-уведомления только при реальном изменении цены:
//      - повышение → пользователям с price_increase = true
//      - понижение → пользователям с price_decrease = true
//   4. При первом сохранении цен (нет снапшотов для города) push НЕ отправляется.
//   5. Обновляет таблицу `price_snapshots` после проверки.
//
// Соответствует App Store Guideline 5.1.1: push идёт только подписчикам с
// явно включённым тоггл-ом соответствующего типа уведомления.
//
// Деплой:
//   supabase functions deploy check-prices --no-verify-jwt
//
// Запуск вручную:
//   curl -X POST \
//     -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
//     https://<project-ref>.supabase.co/functions/v1/check-prices
//
// Cron (каждые 30 минут) — выполнить в SQL Editor один раз:
//   select cron.schedule(
//     'check-prices-every-30m',
//     '*/30 * * * *',
//     $$ select net.http_post(
//          url := 'https://<project-ref>.supabase.co/functions/v1/check-prices',
//          headers := jsonb_build_object(
//            'Content-Type', 'application/json',
//            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
//          )
//        ) $$
//   );
//
// Требуются переменные окружения функции:
//   SUPABASE_URL              (автоматически)
//   SUPABASE_SERVICE_ROLE_KEY (автоматически — функция использует service_role для записи)
//   PRICES_API_URL            (опционально, по умолчанию prod API приложения)

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type Direction = 'increase' | 'decrease' | 'same';

interface PriceInput {
  metalName: string;
  currentPrice: number;
}

interface WpNonFerrousItem {
  name: string;
  cardUnder50: number | null;
  cardFrom50: number | null;
  company: number | null;
}

interface WpFerrousItem {
  name: string;
  card: number | null;
  company: number | null;
}

interface WpCityPrices {
  city: string;
  nonFerrous: WpNonFerrousItem[];
  ferrous: WpFerrousItem[];
}

type WpResponse = Record<string, WpCityPrices>;

interface SnapshotRow {
  city: string;
  metal_name: string;
  current_price: number | string;
}

const DEFAULT_PRICES_API_URL =
  'https://xn--80ajscakgeerhe.xn--p1ai/wp-json/metals/v1/prices';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const isValidPrice = (p: unknown): p is number =>
  typeof p === 'number' && Number.isFinite(p) && p > 0;

const isJunkEntry = (name: string): boolean => {
  if (!name || name.trim().length === 0) return true;
  if (name.startsWith('{')) return true;
  if (name.includes('лицензии на приём')) return true;
  const lower = name.toLowerCase().trim();
  if (lower === 'от 1000кг' || lower === 'до 1000кг') return true;
  if (lower === 'от 1000 кг' || lower === 'до 1000 кг') return true;
  return false;
};

const fetchPrices = async (url: string): Promise<WpResponse> => {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`prices api ${res.status}`);
  return (await res.json()) as WpResponse;
};

const groupPricesByCity = (data: WpResponse): Record<string, PriceInput[]> => {
  const out: Record<string, PriceInput[]> = {};
  for (const [cityId, cityData] of Object.entries(data)) {
    const list: PriceInput[] = [];
    const seen = new Set<string>();
    for (const item of cityData.nonFerrous ?? []) {
      const price = item.cardFrom50 ?? item.cardUnder50 ?? item.company ?? 0;
      if (!isValidPrice(price) || seen.has(item.name)) continue;
      seen.add(item.name);
      list.push({ metalName: item.name, currentPrice: price });
    }
    for (const item of cityData.ferrous ?? []) {
      if (isJunkEntry(item.name)) continue;
      const price = item.card ?? item.company ?? 0;
      if (!isValidPrice(price) || seen.has(item.name)) continue;
      seen.add(item.name);
      list.push({ metalName: item.name, currentPrice: price });
    }
    if (list.length > 0) out[cityId] = list;
  }
  return out;
};

interface PriceChange {
  metalName: string;
  previousPrice: number | null;
  currentPrice: number;
  direction: Direction;
}

const compareCity = async (
  supabase: SupabaseClient,
  city: string,
  prices: PriceInput[],
): Promise<{ changes: PriceChange[]; isFirstRun: boolean }> => {
  const { data: existing, error: selectErr } = await supabase
    .from('price_snapshots')
    .select('city, metal_name, current_price')
    .eq('city', city);

  if (selectErr) {
    console.log('[check-prices] select failed', city, selectErr.message);
    return { changes: [], isFirstRun: false };
  }

  const existingMap = new Map<string, SnapshotRow>();
  (existing ?? []).forEach((r) => existingMap.set(r.metal_name, r as SnapshotRow));
  const isFirstRun = existingMap.size === 0;

  const nowIso = new Date().toISOString();
  const upserts: {
    city: string;
    metal_name: string;
    current_price: number;
    previous_price: number | null;
    direction: Direction;
    updated_at: string;
  }[] = [];
  const changes: PriceChange[] = [];

  for (const p of prices) {
    const prev = existingMap.get(p.metalName);
    const prevPrice = prev ? Number(prev.current_price) : null;
    let direction: Direction = 'same';
    if (prevPrice !== null && isValidPrice(prevPrice)) {
      if (p.currentPrice > prevPrice) direction = 'increase';
      else if (p.currentPrice < prevPrice) direction = 'decrease';
    }
    upserts.push({
      city,
      metal_name: p.metalName,
      current_price: p.currentPrice,
      previous_price: prevPrice,
      direction,
      updated_at: nowIso,
    });
    if (!isFirstRun && prev && direction !== 'same') {
      changes.push({
        metalName: p.metalName,
        previousPrice: prevPrice,
        currentPrice: p.currentPrice,
        direction,
      });
    }
  }

  const { error: upsertErr } = await supabase
    .from('price_snapshots')
    .upsert(upserts, { onConflict: 'city,metal_name' });
  if (upsertErr) {
    console.log('[check-prices] upsert failed', city, upsertErr.message);
  }

  return { changes, isFirstRun };
};

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

const sendExpoPush = async (
  supabase: SupabaseClient,
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> => {
  if (tokens.length === 0) return;
  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    data,
    sound: 'default' as const,
    priority: 'high' as const,
  }));

  for (const batch of chunk(messages, 100)) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });
      const json = (await res.json()) as { data?: ExpoTicket[] };
      const tickets = json.data ?? [];
      const invalidTokens: string[] = [];
      tickets.forEach((t, i) => {
        if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') {
          invalidTokens.push(batch[i].to);
        }
      });
      if (invalidTokens.length > 0) {
        await supabase.from('push_tokens').delete().in('token', invalidTokens);
        console.log('[check-prices] removed invalid tokens', invalidTokens.length);
      }
    } catch (err) {
      console.log('[check-prices] expo push failed (suppressed)', err);
    }
  }
};

const fetchTokensFor = async (
  supabase: SupabaseClient,
  city: string,
  column: 'price_increase' | 'price_decrease',
): Promise<string[]> => {
  const { data, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('city', city)
    .eq(column, true);
  if (error || !data) return [];
  return data.map((r: { token: string }) => r.token).filter(Boolean);
};

const dispatchNotifications = async (
  supabase: SupabaseClient,
  city: string,
  changes: PriceChange[],
): Promise<{ pushedIncrease: number; pushedDecrease: number }> => {
  const increases = changes.filter((c) => c.direction === 'increase');
  const decreases = changes.filter((c) => c.direction === 'decrease');
  let pushedIncrease = 0;
  let pushedDecrease = 0;

  if (increases.length > 0) {
    const tokens = await fetchTokensFor(supabase, city, 'price_increase');
    pushedIncrease = tokens.length;
    if (tokens.length > 0) {
      if (increases.length === 1) {
        const c = increases[0];
        await sendExpoPush(
          supabase,
          tokens,
          'Повышение цены',
          `Цена на ${c.metalName} повысилась до ${c.currentPrice} ₽/кг`,
          { type: 'price_increase', city, metalName: c.metalName, currentPrice: c.currentPrice },
        );
      } else {
        await sendExpoPush(
          supabase,
          tokens,
          'Цены выросли',
          'Изменились цены на металл. Откройте приложение, чтобы посмотреть актуальный прайс.',
          { type: 'price_increase', city, count: increases.length },
        );
      }
    }
  }

  if (decreases.length > 0) {
    const tokens = await fetchTokensFor(supabase, city, 'price_decrease');
    pushedDecrease = tokens.length;
    if (tokens.length > 0) {
      if (decreases.length === 1) {
        const c = decreases[0];
        await sendExpoPush(
          supabase,
          tokens,
          'Снижение цены',
          `Цена на ${c.metalName} понизилась до ${c.currentPrice} ₽/кг`,
          { type: 'price_decrease', city, metalName: c.metalName, currentPrice: c.currentPrice },
        );
      } else {
        await sendExpoPush(
          supabase,
          tokens,
          'Цены снизились',
          'Изменились цены на металл. Откройте приложение, чтобы посмотреть актуальный прайс.',
          { type: 'price_decrease', city, count: decreases.length },
        );
      }
    }
  }

  return { pushedIncrease, pushedDecrease };
};

Deno.serve(async (req) => {
  const startedAt = Date.now();
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ ok: false, error: 'missing supabase env' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const pricesApiUrl = Deno.env.get('PRICES_API_URL') ?? DEFAULT_PRICES_API_URL;
    const raw = await fetchPrices(pricesApiUrl);
    const byCity = groupPricesByCity(raw);

    const report: Array<{
      city: string;
      total: number;
      changes: number;
      isFirstRun: boolean;
      pushedIncrease: number;
      pushedDecrease: number;
    }> = [];

    for (const [city, prices] of Object.entries(byCity)) {
      const { changes, isFirstRun } = await compareCity(supabase, city, prices);
      let pushedIncrease = 0;
      let pushedDecrease = 0;
      if (!isFirstRun && changes.length > 0) {
        const res = await dispatchNotifications(supabase, city, changes);
        pushedIncrease = res.pushedIncrease;
        pushedDecrease = res.pushedDecrease;
      }
      report.push({
        city,
        total: prices.length,
        changes: changes.length,
        isFirstRun,
        pushedIncrease,
        pushedDecrease,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        durationMs: Date.now() - startedAt,
        cities: report,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.log('[check-prices] fatal', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
