import { getSupabase } from './supabase';
import { sendPushNotification } from './pushNotifications';
import type { ApiMetal } from './metalsApi';

// ── Типы ──

export interface PriceHistoryRow {
  city: string;
  metal_name: string;
  category: 'ferrous' | 'non-ferrous';
  current_price: number;
  previous_price: number | null;
  price_diff: number | null;
  percent_diff: number | null;
  date: string;
}

export interface MetalAnalysis {
  metalName: string;
  category: 'ferrous' | 'non-ferrous';
  todayPrice: number;
  yesterdayPrice: number | null;
  priceDiff: number | null;
  percentDiff: number | null;
  sevenDayAvg: number | null;
  thirtyDayAvg: number | null;
  above7Day: boolean;
  above30Day: boolean;
  isGoodToSell: boolean;
  score: number;
  reason: string;
}

export interface SmartAnalysisResult {
  city: string;
  bestMetal: MetalAnalysis | null;
  allMetals: MetalAnalysis[];
  alreadySentToday: boolean;
  message: string;
}

// ── Константы ──

const TITLE = 'Промметпласт';

/** Металлы с высоким спросом — получают бонус к скорингу. */
const HIGH_DEMAND_KEYWORDS: string[] = [
  'медь', 'copper', 'алюминий', 'aluminum', 'латунь', 'brass',
];

/** Категории с бонусом (чёрный металл). */
const FERROUS_BONUS = 1.3;
const HIGH_DEMAND_BONUS = 1.5;

const MIN_PRICE_DIFF_RUB = 10; // минимальная разница в ₽/кг
const MIN_PERCENT_DIFF = 2;    // минимальная разница в %
const MIN_7DAY_EXCESS_PCT = 2; // превышение 7-дневной средней на X%

// ── Утилиты ──

const isHighDemand = (name: string): boolean => {
  const lower = name.toLowerCase();
  return HIGH_DEMAND_KEYWORDS.some((kw) => lower.includes(kw));
};

const getCategoryBonus = (name: string, category: 'ferrous' | 'non-ferrous'): number => {
  if (isHighDemand(name)) return HIGH_DEMAND_BONUS;
  if (category === 'ferrous') return FERROUS_BONUS;
  return 1.0;
};

const avgOrNull = (values: number[]): number | null => {
  const filtered = values.filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0);
  if (filtered.length === 0) return null;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
};

// ── Проверка: отправлено ли уже уведомление сегодня ──

const wasSmartNotifSentToday = async (city: string): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) return false;

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('smart_price_notifications')
    .select('id')
    .eq('city', city)
    .eq('date', today)
    .limit(1);

  if (error) {
    console.log('[smart-analysis] wasSmartNotifSentToday error:', error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
};

// ── Сохранение факта отправки ──

const recordSmartNotification = async (
  city: string,
  metalName: string,
  title: string,
  body: string,
  score: number,
): Promise<void> => {
  const supabase = getSupabase();
  if (!supabase) return;

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from('smart_price_notifications').insert({
    city,
    metal_name: metalName,
    date: today,
    title,
    body,
    score,
  });

  if (error) {
    console.log('[smart-analysis] recordSmartNotification error:', error.message);
  } else {
    console.log('[smart-analysis] smart notification recorded:', city, metalName);
  }
};

// ── Генерация текста уведомления ──

const generateBody = (metal: MetalAnalysis): string => {
  if (metal.priceDiff !== null && metal.priceDiff >= MIN_PRICE_DIFF_RUB) {
    return `Сегодня выгодно сдавать ${metal.metalName.toLowerCase()}: +${Math.round(metal.priceDiff)} ₽ за кг`;
  }
  if (metal.above7Day && metal.sevenDayAvg !== null && metal.todayPrice > metal.sevenDayAvg) {
    return `${metal.metalName} сегодня выше средней цены за неделю`;
  }
  if (metal.percentDiff !== null && metal.percentDiff >= MIN_PERCENT_DIFF) {
    return `Цена на ${metal.metalName.toLowerCase()} выросла на ${Math.round(metal.percentDiff)}% — сегодня хороший день для сдачи`;
  }
  return `Цена на ${metal.metalName.toLowerCase()} выросла — сегодня хороший день для сдачи`;
};

// ── Основной анализ ──

/**
 * Проанализировать цены для одного города и выбрать лучший металл
 * для «умного» push-уведомления.
 *
 * Использует price_snapshots (текущая цена) и price_history (история)
 * для вычисления 7-дневной и 30-дневной средней.
 */
export const analyzeCityPrices = async (
  city: string,
  metals?: ApiMetal[],
): Promise<SmartAnalysisResult> => {
  const empty: SmartAnalysisResult = {
    city,
    bestMetal: null,
    allMetals: [],
    alreadySentToday: false,
    message: '',
  };

  const supabase = getSupabase();
  if (!supabase) {
    empty.message = 'Supabase не настроен';
    return empty;
  }

  // Проверяем, не отправлено ли уже сегодня
  const alreadySent = await wasSmartNotifSentToday(city);
  if (alreadySent) {
    empty.alreadySentToday = true;
    empty.message = 'Умное уведомление уже отправлено сегодня для этого города';
    return empty;
  }

  // Если металлы не переданы — загружаем из Supabase (price_snapshots)
  let metalRows: { metal_name: string; current_price: number; category?: string }[] = [];

  if (metals && metals.length > 0) {
    metalRows = metals.map((m) => ({
      metal_name: m.name,
      current_price: m.pricePerKg,
      category: m.category,
    }));
  } else {
    const { data, error } = await supabase
      .from('price_snapshots')
      .select('metal_name, current_price')
      .eq('city', city);

    if (error || !data || data.length === 0) {
      empty.message = 'Нет данных о ценах для этого города';
      return empty;
    }

    metalRows = data.map((r: { metal_name: string; current_price: number }) => ({
      metal_name: r.metal_name,
      current_price: Number(r.current_price),
    }));
  }

  // Загружаем историю за последние 30 дней
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);
  const since30Str = since30.toISOString().slice(0, 10);

  const { data: historyRows, error: histErr } = await supabase
    .from('price_history')
    .select('city, metal_name, category, current_price, previous_price, price_diff, percent_diff, date')
    .eq('city', city)
    .gte('date', since30Str)
    .order('date', { ascending: false });

  if (histErr) {
    console.log('[smart-analysis] history select error:', histErr.message);
    empty.message = 'Ошибка загрузки истории цен';
    return empty;
  }

  const rows = (historyRows ?? []) as PriceHistoryRow[];

  // Группируем историю по metal_name
  const historyByMetal = new Map<string, PriceHistoryRow[]>();
  for (const r of rows) {
    const list = historyByMetal.get(r.metal_name) ?? [];
    list.push(r);
    historyByMetal.set(r.metal_name, list);
  }

  // Анализируем каждый металл
  const analyses: MetalAnalysis[] = [];

  for (const row of metalRows) {
    const history = historyByMetal.get(row.metal_name) ?? [];
    const category: 'ferrous' | 'non-ferrous' =
      row.category === 'ferrous' ? 'ferrous' : 'non-ferrous';

    const todayPrice = row.current_price;
    const yesterdayRow = history.find((r) => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return r.date === yesterday.toISOString().slice(0, 10);
    });
    const yesterdayPrice = yesterdayRow ? yesterdayRow.current_price : null;

    // Берём цену из ближайшего вчерашнего дня в истории
    // (если точного вчера нет — берём самую свежую запись до сегодня)
    const pastRows = history.filter((r) => r.current_price !== todayPrice);
    const bestYesterday = pastRows.length > 0 ? pastRows[0].current_price : null;

    const priceDiff =
      bestYesterday !== null ? todayPrice - bestYesterday : null;
    const percentDiff =
      bestYesterday !== null && bestYesterday > 0
        ? ((todayPrice - bestYesterday) / bestYesterday) * 100
        : null;

    // 7-дневная средняя (исключая сегодня)
    const last7Days = history
      .filter((r) => r.current_price !== todayPrice)
      .slice(0, 7)
      .map((r) => r.current_price);
    const sevenDayAvg = avgOrNull(last7Days);

    // 30-дневная средняя (исключая сегодня)
    const last30Days = history
      .filter((r) => r.current_price !== todayPrice)
      .slice(0, 30)
      .map((r) => r.current_price);
    const thirtyDayAvg = avgOrNull(last30Days);

    const above7Day =
      sevenDayAvg !== null && todayPrice > sevenDayAvg * (1 + MIN_7DAY_EXCESS_PCT / 100);
    const above30Day =
      thirtyDayAvg !== null && todayPrice > thirtyDayAvg;

    // Условие «хорошо для продажи»
    const priceIncreased = bestYesterday !== null && todayPrice > bestYesterday;
    const hasMeaningfulDiff =
      (priceDiff !== null && priceDiff >= MIN_PRICE_DIFF_RUB) ||
      (percentDiff !== null && percentDiff >= MIN_PERCENT_DIFF) ||
      above7Day;

    const isGoodToSell = priceIncreased && hasMeaningfulDiff;

    // Скоринг
    let score = 0;
    const reasons: string[] = [];

    if (priceDiff !== null && priceDiff > 0) {
      score += priceDiff;
      reasons.push(`+${Math.round(priceDiff)} ₽/кг`);
    }
    if (percentDiff !== null && percentDiff > 0) {
      score += percentDiff * 5; // бонус за процент
      reasons.push(`+${percentDiff.toFixed(1)}%`);
    }
    if (above7Day && sevenDayAvg !== null) {
      const excess = ((todayPrice - sevenDayAvg) / sevenDayAvg) * 100;
      score += excess * 3; // бонус за превышение недельной средней
      reasons.push(`выше 7-дн на ${excess.toFixed(1)}%`);
    }

    // Бонус категории
    const catBonus = getCategoryBonus(row.metal_name, category);
    score *= catBonus;

    analyses.push({
      metalName: row.metal_name,
      category,
      todayPrice,
      yesterdayPrice: bestYesterday,
      priceDiff,
      percentDiff,
      sevenDayAvg,
      thirtyDayAvg,
      above7Day,
      above30Day,
      isGoodToSell,
      score,
      reason: reasons.join(' | ') || 'нет данных',
    });
  }

  // Сортируем по скору (наивысший первым)
  analyses.sort((a, b) => b.score - a.score);

  // Берём лучший металл, который «хорош для продажи»
  const bestMetal = analyses.find((a) => a.isGoodToSell) ?? null;

  return {
    city,
    bestMetal,
    allMetals: analyses,
    alreadySentToday: false,
    message: bestMetal
      ? `Выбран ${bestMetal.metalName} (score: ${bestMetal.score.toFixed(1)})`
      : 'Нет металлов с значимым ростом цены сегодня',
  };
};

// ── Отправка умного уведомления ──

export interface SendSmartResult {
  success: boolean;
  metalName: string | null;
  title: string;
  body: string;
  score: number;
  tokensSent: number;
  error?: string;
}

/**
 * Отправить «умное» push-уведомление для города.
 * Проверяет дубликаты, выбирает лучший металл, фильтрует токены
 * (только price_increase = true, cities содержит targetCity) и отправляет.
 */
export const sendSmartNotification = async (
  city: string,
  metals?: ApiMetal[],
): Promise<SendSmartResult> => {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      metalName: null,
      title: TITLE,
      body: '',
      score: 0,
      tokensSent: 0,
      error: 'Supabase не настроен',
    };
  }

  // Анализ
  const analysis = await analyzeCityPrices(city, metals);

  if (analysis.alreadySentToday) {
    return {
      success: false,
      metalName: null,
      title: TITLE,
      body: '',
      score: 0,
      tokensSent: 0,
      error: 'Уже отправлено сегодня',
    };
  }

  if (!analysis.bestMetal) {
    return {
      success: false,
      metalName: null,
      title: TITLE,
      body: '',
      score: 0,
      tokensSent: 0,
      error: analysis.message || 'Нет подходящего металла',
    };
  }

  const best = analysis.bestMetal;
  const body = generateBody(best);

  // Получаем токены: cities содержит city + price_increase = true
  const { data: tokenRows, error: tokenErr } = await supabase
    .from('push_tokens')
    .select('token')
    .contains('cities', [city])
    .eq('price_increase', true);

  if (tokenErr) {
    return {
      success: false,
      metalName: best.metalName,
      title: TITLE,
      body,
      score: best.score,
      tokensSent: 0,
      error: `Ошибка получения токенов: ${tokenErr.message}`,
    };
  }

  const tokens = (tokenRows ?? [])
    .map((r: { token: string }) => r.token)
    .filter(Boolean);

  if (tokens.length === 0) {
    return {
      success: false,
      metalName: best.metalName,
      title: TITLE,
      body,
      score: best.score,
      tokensSent: 0,
      error: 'Нет подписанных пользователей в этом городе',
    };
  }

  // Отправляем push
  await sendPushNotification(tokens, TITLE, body, {
    type: 'smart_price',
    city,
    metalName: best.metalName,
    priceDiff: best.priceDiff,
    percentDiff: best.percentDiff,
  });

  // Записываем факт отправки
  await recordSmartNotification(city, best.metalName, TITLE, body, best.score);

  return {
    success: true,
    metalName: best.metalName,
    title: TITLE,
    body,
    score: best.score,
    tokensSent: tokens.length,
  };
};

// ── Сохранение price_history из текущих цен ──

/**
 * Сохранить строки price_history из текущих цен (после утреннего обновления).
 * По одной строке на (city, metal_name, date).
 */
export const savePriceHistory = async (
  city: string,
  metals: { name: string; category: 'ferrous' | 'non-ferrous'; pricePerKg: number; previousPrice?: number }[],
): Promise<{ saved: number; error?: string }> => {
  const supabase = getSupabase();
  if (!supabase) return { saved: 0, error: 'Supabase не настроен' };

  const today = new Date().toISOString().slice(0, 10);

  const rows = metals.map((m) => {
    const currentPrice = m.pricePerKg;
    const previousPrice = m.previousPrice ?? null;
    const priceDiff = previousPrice !== null ? currentPrice - previousPrice : null;
    const percentDiff =
      previousPrice !== null && previousPrice > 0
        ? ((currentPrice - previousPrice) / previousPrice) * 100
        : null;

    return {
      city,
      metal_name: m.name,
      category: m.category,
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
    return { saved: 0, error: error.message };
  }

  return { saved: rows.length };
};
