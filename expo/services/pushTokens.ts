import { getSupabase, isSupabaseConfigured } from './supabase';

export interface PushTokenRecord {
  token: string;
  platform: 'ios' | 'android';
  cities: string[];
  priceIncrease: boolean;
  priceDecrease: boolean;
  requestStatus: boolean;
  companyNews: boolean;
}

/**
 * Upsert push token + настройки в Supabase (таблица push_tokens).
 * Конфликт разрешаем по token. Все ошибки логируются в console.error.
 * Если cities пустой — подставляем город по умолчанию, чтобы не было пустого выбора.
 */
export const upsertPushToken = async (record: PushTokenRecord): Promise<boolean> => {
  console.log('[push] upsertPushToken called');
  console.log('[push] isSupabaseConfigured:', isSupabaseConfigured);

  const supabase = getSupabase();
  if (!supabase) {
    console.error('[push] FATAL: getSupabase() returned null', {
      isSupabaseConfigured,
    });
    return false;
  }

  // Безопасность: если cities пуст, подставляем Барнаул
  const cities =
    record.cities.length > 0 ? record.cities : ['Барнаул'];

  const payload = {
    token: record.token,
    platform: record.platform,
    cities,
    price_increase: record.priceIncrease,
    price_decrease: record.priceDecrease,
    request_status: record.requestStatus,
    company_news: record.companyNews,
    updated_at: new Date().toISOString(),
  };

  console.log('[push] upsert payload:', {
    ...payload,
    token: payload.token.slice(0, 24) + '…',
  });

  try {
    const { error, status, statusText } = await supabase
      .from('push_tokens')
      .upsert(payload, { onConflict: 'token' });

    console.log('[push] Supabase response status:', status, statusText);

    if (error) {
      console.error('[push] Supabase upsert FAILED:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        status,
        statusText,
      });
      return false;
    }

    console.log('[push] Token successfully saved to push_tokens ✓');
    return true;
  } catch (err) {
    const e = err as Error;
    console.error('[push] upsertPushToken EXCEPTION:', {
      name: e.name,
      message: e.message,
      stack: e.stack,
    });
    return false;
  }
};

/**
 * Удалить токен по значению — используется при получении DeviceNotRegistered.
 */
export const deletePushToken = async (token: string): Promise<void> => {
  const supabase = getSupabase();
  if (!supabase) {
    console.error('[push] deletePushToken: getSupabase() returned null');
    return;
  }
  try {
    const { error } = await supabase.from('push_tokens').delete().eq('token', token);
    if (error) {
      console.error('[push] Supabase delete token error:', {
        message: error.message,
        code: error.code,
      });
      return;
    }
    console.log('[push] Token successfully deleted from push_tokens');
  } catch (err) {
    const e = err as Error;
    console.error('[push] Supabase delete token exception:', e.message);
  }
};
