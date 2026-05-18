import { getSupabase } from './supabase';
import { getMetalsData, type ApiMetal } from './metalsApi';
import { sendPushNotification } from './pushNotifications';
import { deletePushToken } from './pushTokens';

/**
 * Сравнение текущих цен с сохранёнными снапшотами и отправка push-уведомлений
 * при реальном изменении цены. Соблюдается App Store Guideline 5.1.1:
 * push отправляется только пользователям, явно включившим соответствующий toggle.
 */

export type PriceDirection = 'increase' | 'decrease' | 'same';

export interface PriceInput {
  metalName: string;
  currentPrice: number;
}

interface SnapshotRow {
  city: string;
  metal_name: string;
  current_price: number | string;
  previous_price: number | string | null;
  direction: PriceDirection;
}

export interface PriceChange {
  metalName: string;
  previousPrice: number | null;
  currentPrice: number;
  direction: PriceDirection;
}

export interface CompareResult {
  changes: PriceChange[];
  isFirstRun: boolean;
}

const toNumber = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const isValidPrice = (p: unknown): p is number => {
  return typeof p === 'number' && Number.isFinite(p) && p > 0;
};

/**
 * Сравнить переданные цены с снапшотами в Supabase, обновить снапшоты
 * и (если это не первый запуск для города) отправить уведомления подписчикам.
 *
 * Гарантии:
 * - Не отправляет push при первом сохранении цен для пары (city, metal_name).
 * - Пропускает null/0/нераспознанные цены.
 * - Максимум одно уведомление на металл за один цикл.
 * - Одно агрегированное уведомление на направление (повышение/понижение) на город.
 */
export const compareAndNotifyPrices = async (
  prices: PriceInput[],
  city: string,
): Promise<CompareResult> => {
  const supabase = getSupabase();
  if (!supabase) {
    console.log('[price-notif] supabase not configured, skip');
    return { changes: [], isFirstRun: false };
  }
  if (!city || prices.length === 0) {
    return { changes: [], isFirstRun: false };
  }

  // Дедупликация по metalName — берём первое валидное значение.
  const valid: PriceInput[] = [];
  const seen = new Set<string>();
  for (const p of prices) {
    if (!p.metalName || seen.has(p.metalName)) continue;
    if (!isValidPrice(p.currentPrice)) continue;
    seen.add(p.metalName);
    valid.push(p);
  }
  if (valid.length === 0) return { changes: [], isFirstRun: false };

  // Загрузить существующие снапшоты по городу.
  const { data: existing, error: selectErr } = await supabase
    .from('price_snapshots')
    .select('city, metal_name, current_price, previous_price, direction')
    .eq('city', city);

  if (selectErr) {
    console.log('[price-notif] select failed (suppressed)', selectErr.message);
    return { changes: [], isFirstRun: false };
  }

  const existingMap = new Map<string, SnapshotRow>();
  (existing ?? []).forEach((row) => existingMap.set(row.metal_name, row as SnapshotRow));

  const isFirstRun = existingMap.size === 0;

  const changes: PriceChange[] = [];
  const rowsToUpsert: {
    city: string;
    metal_name: string;
    current_price: number;
    previous_price: number | null;
    direction: PriceDirection;
    updated_at: string;
  }[] = [];

  const nowIso = new Date().toISOString();

  for (const p of valid) {
    const prev = existingMap.get(p.metalName);
    const prevPrice = prev ? toNumber(prev.current_price) : null;
    let direction: PriceDirection = 'same';
    if (prevPrice !== null && isValidPrice(prevPrice)) {
      if (p.currentPrice > prevPrice) direction = 'increase';
      else if (p.currentPrice < prevPrice) direction = 'decrease';
    }

    rowsToUpsert.push({
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

  // Сохраняем снапшоты ВСЕГДА — иначе следующий цикл снова посчитает first run.
  const { error: upsertErr } = await supabase
    .from('price_snapshots')
    .upsert(rowsToUpsert, { onConflict: 'city,metal_name' });
  if (upsertErr) {
    console.log('[price-notif] upsert failed (suppressed)', upsertErr.message);
  }

  if (isFirstRun || changes.length === 0) {
    return { changes: [], isFirstRun };
  }

  // Отправляем уведомления только при реальном изменении.
  await dispatchPriceNotifications(city, changes);

  return { changes, isFirstRun };
};

const fetchTokensFor = async (
  city: string,
  settingColumn: 'price_increase' | 'price_decrease',
): Promise<string[]> => {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('city', city)
      .eq(settingColumn, true);
    if (error || !data) return [];
    return data.map((r: { token: string }) => r.token).filter(Boolean);
  } catch (err) {
    console.log('[price-notif] fetch tokens failed (suppressed)', err);
    return [];
  }
};

const dispatchPriceNotifications = async (
  city: string,
  changes: PriceChange[],
): Promise<void> => {
  const increases = changes.filter((c) => c.direction === 'increase');
  const decreases = changes.filter((c) => c.direction === 'decrease');

  // Повышение — одно агрегированное уведомление на направление.
  if (increases.length > 0) {
    const tokens = await fetchTokensFor(city, 'price_increase');
    if (tokens.length > 0) {
      if (increases.length === 1) {
        const c = increases[0];
        await sendPushNotification(
          tokens,
          'Повышение цены',
          `Цена на ${c.metalName} повысилась до ${c.currentPrice} ₽/кг`,
          {
            type: 'price_increase',
            city,
            metalName: c.metalName,
            currentPrice: c.currentPrice,
            previousPrice: c.previousPrice,
          },
        );
      } else {
        await sendPushNotification(
          tokens,
          'Цены выросли',
          'Изменились цены на металл. Откройте приложение, чтобы посмотреть актуальный прайс.',
          { type: 'price_increase', city, count: increases.length },
        );
      }
    }
  }

  // Понижение — одно агрегированное уведомление на направление.
  if (decreases.length > 0) {
    const tokens = await fetchTokensFor(city, 'price_decrease');
    if (tokens.length > 0) {
      if (decreases.length === 1) {
        const c = decreases[0];
        await sendPushNotification(
          tokens,
          'Снижение цены',
          `Цена на ${c.metalName} понизилась до ${c.currentPrice} ₽/кг`,
          {
            type: 'price_decrease',
            city,
            metalName: c.metalName,
            currentPrice: c.currentPrice,
            previousPrice: c.previousPrice,
          },
        );
      } else {
        await sendPushNotification(
          tokens,
          'Цены снизились',
          'Изменились цены на металл. Откройте приложение, чтобы посмотреть актуальный прайс.',
          { type: 'price_decrease', city, count: decreases.length },
        );
      }
    }
  }
};

/**
 * Высокоуровневый helper: загружает актуальные цены из API,
 * сравнивает со снапшотами и отправляет уведомления при изменении.
 * Если city не указан — проходит по всем городам, найденным в API.
 */
export const sendPriceChangeNotifications = async (
  city?: string,
): Promise<{ city: string; result: CompareResult }[]> => {
  const out: { city: string; result: CompareResult }[] = [];
  try {
    const { metals } = await getMetalsData();
    const byCity = groupMetalsByCity(metals);
    const targetCities = city ? [city] : Object.keys(byCity);

    for (const cityId of targetCities) {
      const list = byCity[cityId] ?? [];
      const prices: PriceInput[] = list
        .filter((m) => isValidPrice(m.pricePerKg))
        .map((m) => ({ metalName: m.name, currentPrice: m.pricePerKg }));
      if (prices.length === 0) continue;
      const result = await compareAndNotifyPrices(prices, cityId);
      out.push({ city: cityId, result });
    }
  } catch (err) {
    console.log('[price-notif] sendPriceChangeNotifications failed (suppressed)', err);
  }
  return out;
};

const groupMetalsByCity = (metals: ApiMetal[]): Record<string, ApiMetal[]> => {
  const acc: Record<string, ApiMetal[]> = {};
  for (const m of metals) {
    if (!acc[m.cityId]) acc[m.cityId] = [];
    acc[m.cityId].push(m);
  }
  return acc;
};

// Экспортируем для тестов/отладки
export const __internal = { deletePushToken };
