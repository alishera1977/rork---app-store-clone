import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured: boolean = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

console.log('[supabase] Configured:', isSupabaseConfigured, '| URL:', SUPABASE_URL ? SUPABASE_URL.slice(0, 50) + '…' : '<empty>', '| Key present:', Boolean(SUPABASE_ANON_KEY));

let client: SupabaseClient | null = null;

/**
 * Ленивая инициализация клиента Supabase. Если переменные окружения
 * не заданы — возвращаем null, чтобы не ломать существующее приложение.
 */
export const getSupabase = (): SupabaseClient | null => {
  if (!isSupabaseConfigured) return null;
  if (client) return client;
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
};
