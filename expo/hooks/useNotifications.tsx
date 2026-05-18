import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { upsertPushToken } from '@/services/pushTokens';

const STORAGE_KEY = 'notifications-state-v1';

export type NotificationCategory =
  | 'priceUp'
  | 'priceDown'
  | 'requestStatus'
  | 'companyNews';

export type NotificationPrefs = Record<NotificationCategory, boolean>;

export type NotificationPermissionStatus =
  | 'undetermined'
  | 'softDismissed'
  | 'granted'
  | 'denied';

interface PersistedState {
  status: NotificationPermissionStatus;
  prefs: NotificationPrefs;
  expoPushToken: string | null;
  city: string | null;
}

const DEFAULT_PREFS: NotificationPrefs = {
  priceUp: true,
  priceDown: true,
  requestStatus: true,
  companyNews: true,
};

const DEFAULT_STATE: PersistedState = {
  status: 'undetermined',
  prefs: DEFAULT_PREFS,
  expoPushToken: null,
  city: null,
};

interface PushTokenPayload {
  token: string;
  platform: 'ios' | 'android';
  city: string | null;
  settings: {
    priceIncrease: boolean;
    priceDecrease: boolean;
    requestStatus: boolean;
    companyNews: boolean;
  };
}

const toApiSettings = (prefs: NotificationPrefs): PushTokenPayload['settings'] => ({
  priceIncrease: prefs.priceUp,
  priceDecrease: prefs.priceDown,
  requestStatus: prefs.requestStatus,
  companyNews: prefs.companyNews,
});

/**
 * Отправка токена и настроек в Supabase (таблица push_tokens).
 * Если Supabase не сконфигурирован или сеть недоступна — подавляем ошибки,
 * локальные настройки в AsyncStorage сохраняются всегда (Guideline 5.1.1 ок).
 *
 * Дополнительно: если задан EXPO_PUBLIC_PUSH_API_URL — дублируем POST туда,
 * чтобы сохранить совместимость со старым кастомным backend.
 */
const postPushToken = async (payload: PushTokenPayload): Promise<void> => {
  await upsertPushToken({
    token: payload.token,
    platform: payload.platform,
    city: payload.city,
    priceIncrease: payload.settings.priceIncrease,
    priceDecrease: payload.settings.priceDecrease,
    requestStatus: payload.settings.requestStatus,
    companyNews: payload.settings.companyNews,
  });

  const baseUrl = process.env.EXPO_PUBLIC_PUSH_API_URL;
  if (!baseUrl) return;
  const url = `${baseUrl.replace(/\/$/, '')}/push-token`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.log('[push] backend responded with non-ok status', res.status);
    }
  } catch (err) {
    console.log('[push] sync failed (suppressed)', err);
  }
};

/**
 * Управление push-уведомлениями (только iOS).
 *
 * Соответствует Apple Guideline 5.1.1: после отказа пользователя
 * не показываем повторных popup, не открываем настройки iOS автоматически,
 * не блокируем экраны.
 */
export const [NotificationsProvider, useNotifications] = createContextHook(() => {
  const [state, setState] = useState<PersistedState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [requesting, setRequesting] = useState<boolean>(false);
  const stateRef = useRef<PersistedState>(DEFAULT_STATE);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let mounted = true;

    const load = async (): Promise<void> => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (mounted && raw) {
          const parsed = JSON.parse(raw) as Partial<PersistedState>;
          const next: PersistedState = {
            status: parsed.status ?? 'undetermined',
            prefs: { ...DEFAULT_PREFS, ...(parsed.prefs ?? {}) },
            expoPushToken: parsed.expoPushToken ?? null,
            city: parsed.city ?? null,
          };
          setState(next);
          stateRef.current = next;
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setHydrated(true);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const persist = useCallback((next: PersistedState): void => {
    stateRef.current = next;
    setState(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const sync = useCallback(async (override?: Partial<PersistedState>): Promise<void> => {
    const current: PersistedState = { ...stateRef.current, ...(override ?? {}) };
    if (!current.expoPushToken) {
      console.log('[push] no token yet, skip sync');
      return;
    }
    await postPushToken({
      token: current.expoPushToken,
      platform: Platform.OS === 'android' ? 'android' : 'ios',
      city: current.city,
      settings: toApiSettings(current.prefs),
    });
  }, []);

  const dismissSoftPrompt = useCallback((): void => {
    persist({ ...stateRef.current, status: 'softDismissed' });
  }, [persist]);

  /**
   * Показывает системный диалог iOS. После отказа повторно НЕ просим,
   * настройки автоматически НЕ открываем (Guideline 5.1.1).
   */
  const requestSystemPermission = useCallback(async (): Promise<NotificationPermissionStatus> => {
    if (Platform.OS !== 'ios') {
      persist({ ...stateRef.current, status: 'denied' });
      return 'denied';
    }
    setRequesting(true);
    try {
      let finalStatus: 'granted' | 'denied' = 'denied';
      let token: string | null = null;

      try {
        // Динамический импорт: в Expo Go модули отсутствуют, в production-сборке
        // (EAS / dev-client) подхватятся автоматически.
        const Notifications = await import('expo-notifications').catch(() => null);
        const Device = await import('expo-device').catch(() => null);

        if (Notifications && Device) {
          const existing = await Notifications.getPermissionsAsync();
          let status = existing.status;
          if (status !== 'granted') {
            const req = await Notifications.requestPermissionsAsync({
              ios: { allowAlert: true, allowBadge: true, allowSound: true },
            });
            status = req.status;
          }
          finalStatus = status === 'granted' ? 'granted' : 'denied';

          if (finalStatus === 'granted' && Device.isDevice) {
            try {
              const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
              const tokenRes = await Notifications.getExpoPushTokenAsync(
                projectId ? { projectId } : undefined,
              );
              token = tokenRes.data;
            } catch (err) {
              console.log('[push] getExpoPushTokenAsync failed (suppressed)', err);
            }
          }
        } else {
          // Expo Go fallback — без реального токена, но не блокируем UX.
          finalStatus = 'granted';
        }
      } catch (err) {
        console.log('[push] permission flow failed (suppressed)', err);
        finalStatus = 'denied';
      }

      const next: PersistedState = {
        ...stateRef.current,
        status: finalStatus,
        expoPushToken: token ?? stateRef.current.expoPushToken,
      };
      persist(next);

      if (finalStatus === 'granted' && next.expoPushToken) {
        void sync(next);
      }
      return finalStatus;
    } finally {
      setRequesting(false);
    }
  }, [persist, sync]);

  const setPref = useCallback(
    (key: NotificationCategory, value: boolean): void => {
      const next: PersistedState = {
        ...stateRef.current,
        prefs: { ...stateRef.current.prefs, [key]: value },
      };
      persist(next);
      // При изменении тоггла пересылаем актуальные настройки на backend.
      void sync(next);
    },
    [persist, sync],
  );

  const setCity = useCallback(
    (city: string | null): void => {
      if (stateRef.current.city === city) return;
      const next: PersistedState = { ...stateRef.current, city };
      persist(next);
      void sync(next);
    },
    [persist, sync],
  );

  const syncToBackend = useCallback(async (): Promise<void> => {
    await sync();
  }, [sync]);

  const shouldShowSoftPrompt = useMemo<boolean>(
    () => hydrated && Platform.OS === 'ios' && state.status === 'undetermined',
    [hydrated, state.status],
  );

  return {
    hydrated,
    requesting,
    status: state.status,
    prefs: state.prefs,
    expoPushToken: state.expoPushToken,
    city: state.city,
    shouldShowSoftPrompt,
    dismissSoftPrompt,
    requestSystemPermission,
    setPref,
    setCity,
    syncToBackend,
  };
});
