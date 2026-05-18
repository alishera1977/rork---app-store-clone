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
 * Конфликт разрешаем по token. Любые ошибки подавляем — приложение
 * продолжает работать с локальными настройками.
 */
export const upsertPushToken = async (record: PushTokenRecord): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) {
    console.log('[push] supabase not configured, skip upsert');
    return false;
  }
  try {
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
      console.log('[push] supabase upsert error (suppressed)', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.log('[push] supabase upsert failed (suppressed)', err);
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
    await supabase.from('push_tokens').delete().eq('token', token);
  } catch (err) {
    console.log('[push] delete token failed (suppressed)', err);
  }
};
