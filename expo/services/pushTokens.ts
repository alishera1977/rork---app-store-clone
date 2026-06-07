import { getSupabase } from './supabase';

export interface PushTokenRecord {
  token: string;
  platform: 'ios' | 'android';
  city: string | null;
  priceIncrease: boolean;
  priceDecrease: boolean;
  requestStatus: boolean;
  companyNews: boolean;
}

/**
 * Upsert push token + настройки в Supabase (таблица push_tokens).
 * Конфликт разрешаем по token. Ошибки логируем в console.error.
 */
export const upsertPushToken = async (record: PushTokenRecord): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('[push] Supabase not configured, cannot upsert push token');
    return false;
  }
  try {
    console.log('[push] upserting token to push_tokens', {
      tokenPreview: record.token.slice(0, 24) + '…',
      platform: record.platform,
      city: record.city,
      priceIncrease: record.priceIncrease,
      priceDecrease: record.priceDecrease,
      requestStatus: record.requestStatus,
      companyNews: record.companyNews,
    });
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          token: record.token,
          platform: record.platform,
          city: record.city,
          price_increase: record.priceIncrease,
          price_decrease: record.priceDecrease,
          request_status: record.requestStatus,
          company_news: record.companyNews,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' },
      );
    if (error) {
      console.error('[push] Supabase upsert error', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return false;
    }
    console.log('[push] Token successfully saved to push_tokens');
    return true;
  } catch (err) {
    console.error('[push] Supabase upsert exception', err);
    return false;
  }
};

/**
 * Удалить токен по значению — используется при получении DeviceNotRegistered.
 */
export const deletePushToken = async (token: string): Promise<void> => {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('push_tokens').delete().eq('token', token);
    if (error) {
      console.error('[push] Supabase delete token error', {
        message: error.message,
        code: error.code,
      });
      return;
    }
    console.log('[push] Token successfully deleted from push_tokens');
  } catch (err) {
    console.error('[push] Supabase delete token exception', err);
  }
};
