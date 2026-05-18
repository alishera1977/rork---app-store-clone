import { getSupabase } from './supabase';
import { deletePushToken } from './pushTokens';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoPushResponse {
  data?: ExpoPushTicket[];
  errors?: { code: string; message: string }[];
}

export type NotificationCategoryKey =
  | 'price_increase'
  | 'price_decrease'
  | 'request_status'
  | 'company_news';

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/**
 * Базовый sender. Отправляет на Expo Push API батчами и удаляет
 * невалидные токены (DeviceNotRegistered) из Supabase.
 */
export const sendPushNotification = async (
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> => {
  const unique = Array.from(new Set(tokens.filter((t) => typeof t === 'string' && t.length > 0)));
  if (unique.length === 0) return;

  for (const batch of chunk(unique, BATCH_SIZE)) {
    const messages: ExpoPushMessage[] = batch.map((to) => ({
      to,
      title,
      body,
      data,
      sound: 'default',
      priority: 'high',
    }));
    try {
      const res = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      const json = (await res.json().catch(() => null)) as ExpoPushResponse | null;
      if (!json || !Array.isArray(json.data)) continue;

      const invalid: string[] = [];
      json.data.forEach((ticket, idx) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          invalid.push(batch[idx]);
        }
      });
      for (const token of invalid) {
        await deletePushToken(token);
      }
    } catch (err) {
      console.log('[push] expo send failed (suppressed)', err);
    }
  }
};

interface TargetFilter {
  city?: string | null;
  /** Имя колонки настройки, должна быть true. */
  requireSetting?: NotificationCategoryKey;
}

/**
 * Получить активные токены по фильтру (город + включённая категория).
 * Подготовлено для будущих расширений (тип металла можно добавить как колонку).
 */
const fetchTargetTokens = async (filter: TargetFilter): Promise<string[]> => {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    let query = supabase.from('push_tokens').select('token');
    if (filter.requireSetting) {
      query = query.eq(filter.requireSetting, true);
    }
    if (filter.city) {
      query = query.eq('city', filter.city);
    }
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row: { token: string }) => row.token);
  } catch (err) {
    console.log('[push] fetchTargetTokens failed (suppressed)', err);
    return [];
  }
};

export interface PriceNotificationOptions {
  metalName: string;
  price: number | string;
  unit?: string;
  city?: string | null;
  data?: Record<string, unknown>;
}

export const sendPriceIncreaseNotification = async (
  opts: PriceNotificationOptions,
): Promise<void> => {
  const tokens = await fetchTargetTokens({
    city: opts.city,
    requireSetting: 'price_increase',
  });
  const unit = opts.unit ?? '₽/кг';
  await sendPushNotification(
    tokens,
    'Цены выросли',
    `Цена на ${opts.metalName} увеличилась до ${opts.price} ${unit}`,
    { type: 'price_increase', metalName: opts.metalName, price: opts.price, ...opts.data },
  );
};

export const sendPriceDecreaseNotification = async (
  opts: PriceNotificationOptions,
): Promise<void> => {
  const tokens = await fetchTargetTokens({
    city: opts.city,
    requireSetting: 'price_decrease',
  });
  const unit = opts.unit ?? '₽/кг';
  await sendPushNotification(
    tokens,
    'Цены снизились',
    `Цена на ${opts.metalName} снизилась до ${opts.price} ${unit}`,
    { type: 'price_decrease', metalName: opts.metalName, price: opts.price, ...opts.data },
  );
};

export interface RequestStatusNotificationOptions {
  /** Конкретный токен пользователя — приоритетнее, чем фильтр по городу. */
  token?: string;
  city?: string | null;
  statusText: string;
  data?: Record<string, unknown>;
}

export const sendRequestStatusNotification = async (
  opts: RequestStatusNotificationOptions,
): Promise<void> => {
  let tokens: string[];
  if (opts.token) {
    tokens = [opts.token];
  } else {
    tokens = await fetchTargetTokens({
      city: opts.city,
      requireSetting: 'request_status',
    });
  }
  await sendPushNotification(
    tokens,
    'Статус заявки',
    opts.statusText,
    { type: 'request_status', ...opts.data },
  );
};

export interface CompanyNewsNotificationOptions {
  title?: string;
  body: string;
  city?: string | null;
  data?: Record<string, unknown>;
}

export const sendCompanyNewsNotification = async (
  opts: CompanyNewsNotificationOptions,
): Promise<void> => {
  const tokens = await fetchTargetTokens({
    city: opts.city,
    requireSetting: 'company_news',
  });
  await sendPushNotification(
    tokens,
    opts.title ?? 'Новости компании',
    opts.body,
    { type: 'company_news', ...opts.data },
  );
};
