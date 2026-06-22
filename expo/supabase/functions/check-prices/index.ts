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
//   6. Сохраняет ежедневную историю цен в таблицу `price_history`.
//   7. Анализирует, какой металл выгоднее всего сдавать сегодня.
//   8. Отправляет одно «умное» уведомление на город (только price_increase = true).
//   9. Записывает факт отправки в `smart_price_notifications` (защита от повторов).
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
// Cron (раз в день в 9:00 утра по Москве, UTC+3 → 6:00 UTC) — выполнить в SQL Editor один раз:
//   select cron.schedule(
//     'check-prices-daily-9am',
//     '0 6 * * *',
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

// ═══════════════════════════════════════════════════════════════
// Smart Price Analysis — «умное» уведомление (одно на город в день)
// ═══════════════════════════════════════════════════════════════

const SMART_TITLE = 'Промметпласт';
const MIN_PRICE_DIFF_RUB = 10;
const MIN_PERCENT_DIFF = 2;
const MIN_7DAY_EXCESS_PCT = 2;

const HIGH_DEMAND_NAMES = ['медь', 'copper', 'алюминий', 'aluminum', 'латунь', 'brass'];

const isHighDemand = (name: string): boolean =>
  HIGH_DEMAND_NAMES.some((kw) => name.toLowerCase().includes(kw));

const getCategoryBonus = (name: string, category: string): number => {
  if (isHighDemand(name)) return 1.5;
  if (category === 'ferrous') return 1.3;
  return 1.0;
};

const avgSafe = (vals: number[]): number | null => {
  const f = vals.filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0);
  if (f.length === 0) return null;
  return f.reduce((a, b) => a + b, 0) / f.length;
};

/** Сгенерировать текст умного уведомления. */
const makeSmartBody = (metalName: string, priceDiff: number | null, percentDiff: number | null, above7Day: boolean, todayPrice: number, sevenDayAvg: number | null): string => {
  if (priceDiff !== null && priceDiff >= MIN_PRICE_DIFF_RUB) {
    return `Сегодня выгодно сдавать ${metalName.toLowerCase()}: +${Math.round(priceDiff)} ₽ за кг`;
  }
  if (above7Day && sevenDayAvg !== null && todayPrice > sevenDayAvg) {
    return `${metalName} сегодня выше средней цены за неделю`;
  }
  if (percentDiff !== null && percentDiff >= MIN_PERCENT_DIFF) {
    return `Цена на ${metalName.toLowerCase()} выросла на ${Math.round(percentDiff)}% — сегодня хороший день для сдачи`;
  }
  return `Цена на ${metalName.toLowerCase()} выросла — сегодня хороший день для сдачи`;
};

/**
 * Сохранить price_history из текущих цен.
 *
 * ВАЖНО: вызывается ПОСЛЕ compareCity, которая уже обновила price_snapshots
 * (current_price = сегодня, previous_price = вчера). Поэтому читаем previous_price
 * из снапшотов — это реальная вчерашняя цена.
 */
const savePriceHistory = async (
  supabase: SupabaseClient,
  city: string,
  prices: PriceInput[],
  categoryMap: Map<string, 'ferrous' | 'non-ferrous'>,
): Promise<number> => {
  const today = new Date().toISOString().slice(0, 10);

  // Загружаем previous_price из снапшотов (это вчерашняя цена, compareCity уже сохранила её)
  const { data: snapshots } = await supabase
    .from('price_snapshots')
    .select('metal_name, previous_price')
    .eq('city', city);

  const snapPrevMap = new Map<string, number | null>();
  (snapshots ?? []).forEach((s: { metal_name: string; previous_price: number | null }) => {
    const val = s.previous_price !== null ? Number(s.previous_price) : null;
    if (val !== null && Number.isFinite(val) && val > 0) {
      snapPrevMap.set(s.metal_name, val);
    }
  });

  const rows = prices.map((p) => {
    const cat = categoryMap.get(p.metalName) ?? 'non-ferrous';
    const currentPrice = p.currentPrice;
    const previousPrice = snapPrevMap.get(p.metalName) ?? null;
    const priceDiff = previousPrice !== null ? currentPrice - previousPrice : null;
    const percentDiff =
      previousPrice !== null && previousPrice > 0
        ? ((currentPrice - previousPrice) / previousPrice) * 100
        : null;

    return {
      city,
      metal_name: p.metalName,
      category: cat,
      current_price: currentPrice,
      previous_price: previousPrice,
      price_diff: priceDiff,
      percent_diff: percentDiff,
      date: today,
    };
  });

  const { error } = await supabase
    .from('price_history')
    .upsert(rows, { onConflict: 'city,metal_name,date' });

  if (error) {
    console.log('[check-prices] price_history upsert failed', city, error.message);
    return 0;
  }
  console.log('[check-prices] price_history saved:', city, rows.length, 'rows');
  return rows.length;
};

interface MetalAnalysis {
  metalName: string;
  category: 'ferrous' | 'non-ferrous';
  todayPrice: number;
  yesterdayPrice: number | null;
  priceDiff: number | null;
  percentDiff: number | null;
  sevenDayAvg: number | null;
  above7Day: boolean;
  isGoodToSell: boolean;
  score: number;
}

/** Проанализировать город и выбрать лучший металл для умного уведомления. */
const analyzeCitySmart = async (
  supabase: SupabaseClient,
  city: string,
  prices: PriceInput[],
  categoryMap: Map<string, 'ferrous' | 'non-ferrous'>,
): Promise<{ best: MetalAnalysis | null; all: MetalAnalysis[] }> => {
  // Загружаем историю за 30 дней
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);
  const since30Str = since30.toISOString().slice(0, 10);

  const { data: histRows, error: histErr } = await supabase
    .from('price_history')
    .select('metal_name, current_price, date')
    .eq('city', city)
    .gte('date', since30Str)
    .order('date', { ascending: false });

  if (histErr) {
    console.log('[check-prices] smart analysis history select failed', city, histErr.message);
    return { best: null, all: [] };
  }

  // Группируем историю по metal_name
  const histByMetal = new Map<string, { current_price: number; date: string }[]>();
  (histRows ?? []).forEach((r: { metal_name: string; current_price: number; date: string }) => {
    const list = histByMetal.get(r.metal_name) ?? [];
    list.push(r);
    histByMetal.set(r.metal_name, list);
  });

  const analyses: MetalAnalysis[] = [];

  for (const p of prices) {
    const history = histByMetal.get(p.metalName) ?? [];
    const cat = categoryMap.get(p.metalName) ?? 'non-ferrous';
    const todayPrice = p.currentPrice;

    // Вчерашняя цена: самая свежая запись в истории (не сегодня)
    const pastRows = history.filter((r) => r.current_price !== todayPrice);
    const yesterdayPrice = pastRows.length > 0 ? pastRows[0].current_price : null;

    const priceDiff = yesterdayPrice !== null ? todayPrice - yesterdayPrice : null;
    const percentDiff =
      yesterdayPrice !== null && yesterdayPrice > 0
        ? ((todayPrice - yesterdayPrice) / yesterdayPrice) * 100
        : null;

    // 7-дневная средняя
    const last7 = pastRows.slice(0, 7).map((r) => r.current_price);
    const sevenDayAvg = avgSafe(last7);

    const above7Day =
      sevenDayAvg !== null && todayPrice > sevenDayAvg * (1 + MIN_7DAY_EXCESS_PCT / 100);

    // Условия «хорошо для продажи»
    const priceIncreased = yesterdayPrice !== null && todayPrice > yesterdayPrice;
    const hasMeaningfulDiff =
      (priceDiff !== null && priceDiff >= MIN_PRICE_DIFF_RUB) ||
      (percentDiff !== null && percentDiff >= MIN_PERCENT_DIFF) ||
      above7Day;

    const isGoodToSell = priceIncreased && hasMeaningfulDiff;

    // Скоринг
    let score = 0;
    if (priceDiff !== null && priceDiff > 0) score += priceDiff;
    if (percentDiff !== null && percentDiff > 0) score += percentDiff * 5;
    if (above7Day && sevenDayAvg !== null) {
      score += ((todayPrice - sevenDayAvg) / sevenDayAvg) * 100 * 3;
    }
    score *= getCategoryBonus(p.metalName, cat);

    analyses.push({
      metalName: p.metalName,
      category: cat,
      todayPrice,
      yesterdayPrice,
      priceDiff,
      percentDiff,
      sevenDayAvg,
      above7Day,
      isGoodToSell,
      score,
    });
  }

  analyses.sort((a, b) => b.score - a.score);
  const best = analyses.find((a) => a.isGoodToSell) ?? null;

  return { best, all: analyses };
};

/** Отправить умное уведомление для города (если ещё не отправлено сегодня). */
const trySendSmartNotification = async (
  supabase: SupabaseClient,
  city: string,
  best: MetalAnalysis,
): Promise<{ sent: boolean; tokens: number; body: string }> => {
  // Проверка: не отправлено ли уже сегодня
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from('smart_price_notifications')
    .select('id')
    .eq('city', city)
    .eq('date', today)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log('[check-prices] smart notif already sent today for', city);
    return { sent: false, tokens: 0, body: '' };
  }

  const body = makeSmartBody(
    best.metalName,
    best.priceDiff,
    best.percentDiff,
    best.above7Day,
    best.todayPrice,
    best.sevenDayAvg,
  );

  // Токены: city + price_increase = true
  const tokens = await fetchTokensFor(supabase, city, 'price_increase');
  if (tokens.length === 0) {
    console.log('[check-prices] smart notif: no tokens for', city);
    return { sent: false, tokens: 0, body };
  }

  await sendExpoPush(supabase, tokens, SMART_TITLE, body, {
    type: 'smart_price',
    city,
    metalName: best.metalName,
    priceDiff: best.priceDiff,
    percentDiff: best.percentDiff,
  });

  // Запись факта отправки
  const { error: insErr } = await supabase.from('smart_price_notifications').insert({
    city,
    metal_name: best.metalName,
    date: today,
    title: SMART_TITLE,
    body,
    score: best.score,
  });

  if (insErr) {
    console.log('[check-prices] smart notif insert failed', city, insErr.message);
  }

  console.log('[check-prices] smart notif SENT:', city, best.metalName, '→', tokens.length, 'tokens');
  return { sent: true, tokens: tokens.length, body };
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

    // Строим карту категорий из сырых данных
    const categoryMap = new Map<string, 'ferrous' | 'non-ferrous'>();
    for (const [, cityData] of Object.entries(raw)) {
      for (const item of cityData.nonFerrous ?? []) {
        categoryMap.set(item.name, 'non-ferrous');
      }
      for (const item of cityData.ferrous ?? []) {
        if (!isJunkEntry(item.name)) categoryMap.set(item.name, 'ferrous');
      }
    }

    const byCity = groupPricesByCity(raw);

    const report: Array<{
      city: string;
      total: number;
      changes: number;
      isFirstRun: boolean;
      pushedIncrease: number;
      pushedDecrease: number;
      historySaved: number;
      smartNotif: { sent: boolean; tokens: number; metal: string | null; body: string } | null;
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

      // Сохраняем price_history
      const historySaved = await savePriceHistory(supabase, city, prices, categoryMap);

      // Умный анализ
      let smartNotif: { sent: boolean; tokens: number; metal: string | null; body: string } | null = null;
      const { best } = await analyzeCitySmart(supabase, city, prices, categoryMap);
      if (best) {
        const result = await trySendSmartNotification(supabase, city, best);
        smartNotif = {
          sent: result.sent,
          tokens: result.tokens,
          metal: result.sent ? best.metalName : null,
          body: result.body || '',
        };
      }

      report.push({
        city,
        total: prices.length,
        changes: changes.length,
        isFirstRun,
        pushedIncrease,
        pushedDecrease,
        historySaved,
        smartNotif,
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
