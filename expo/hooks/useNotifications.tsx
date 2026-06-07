import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
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
 * Все ошибки логируются в console.error.
 *
 * Дополнительно: если задан EXPO_PUBLIC_PUSH_API_URL — дублируем POST туда,
 * чтобы сохранить совместимость со старым кастомным backend.
 */
const postPushToken = async (payload: PushTokenPayload): Promise<void> => {
  console.log('[push] === postPushToken START ===');
  console.log('[push] token:', (payload.token ?? '').slice(0, 24) + '…');
  console.log('[push] platform:', payload.platform);
  console.log('[push] city being saved:', payload.city);
  console.log('[push] settings:', payload.settings);

  try {
    const result = await upsertPushToken({
      token: payload.token,
      platform: payload.platform,
      city: payload.city,
      priceIncrease: payload.settings.priceIncrease,
      priceDecrease: payload.settings.priceDecrease,
      requestStatus: payload.settings.requestStatus,
      companyNews: payload.settings.companyNews,
    });
    console.log('[push] upsertPushToken result:', result);
  } catch (err) {
    console.error('[push] upsertPushToken threw exception:', err);
  }

  const baseUrl = process.env.EXPO_PUBLIC_PUSH_API_URL;
  if (!baseUrl) {
    console.log('[push] No EXPO_PUBLIC_PUSH_API_URL set, skipping legacy backend sync');
    console.log('[push] === postPushToken END ===');
    return;
  }
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
      console.error('[push] legacy backend responded with non-ok status', res.status, await res.text().catch(() => ''));
    } else {
      console.log('[push] legacy backend sync OK');
    }
  } catch (err) {
    console.error('[push] legacy backend sync failed:', err);
  }
  console.log('[push] === postPushToken END ===');
};

// Настройка обработчика входящих уведомлений (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Управление push-уведомлениями (только iOS).
 *
 * Соответствует Apple Guideline 5.1.1: после отказа пользователя
 * не показываем повторных popup, не открываем настройки iOS автоматически,
 * не блокируем экраны.
 *
 * При старте приложения автоматически синхронизирует токен с Supabase.
 */
export const [NotificationsProvider, useNotifications] = createContextHook(() => {
  const [state, setState] = useState<PersistedState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [requesting, setRequesting] = useState<boolean>(false);
  const stateRef = useRef<PersistedState>(DEFAULT_STATE);
  const syncedRef = useRef<boolean>(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Загрузка сохранённого состояния из AsyncStorage
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
          console.log('[push] Loaded persisted state from AsyncStorage:', {
            status: next.status,
            hasToken: !!next.expoPushToken,
            tokenPreview: next.expoPushToken ? next.expoPushToken.slice(0, 24) + '…' : null,
            city: next.city,
            prefs: next.prefs,
          });
        }
      } catch (err) {
        console.error('[push] Failed to load persisted state:', err);
      } finally {
        if (mounted) {
          setHydrated(true);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  // Авто-синхронизация токена при старте приложения
  useEffect(() => {
    if (!hydrated) return;
    if (syncedRef.current) return;

    const current = stateRef.current;
    if (current.expoPushToken && current.status === 'granted') {
      console.log('[push] Auto-syncing existing token on app start');
      syncedRef.current = true;
      void postPushToken({
        token: current.expoPushToken,
        platform: Platform.OS === 'android' ? 'android' : 'ios',
        city: current.city,
        settings: toApiSettings(current.prefs),
      });
    } else {
      console.log('[push] No existing token or not granted, skipping auto-sync on start', {
        hasToken: !!current.expoPushToken,
        status: current.status,
      });
    }
  }, [hydrated]);

  const persist = useCallback((next: PersistedState): void => {
    stateRef.current = next;
    setState(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((err) => {
      console.error('[push] Failed to persist state to AsyncStorage:', err);
    });
  }, []);

  const sync = useCallback(async (override?: Partial<PersistedState>): Promise<void> => {
    const current: PersistedState = { ...stateRef.current, ...(override ?? {}) };
    if (!current.expoPushToken) {
      console.log('[push] sync: no token yet, skip');
      return;
    }
    console.log('[push] sync: sending token to backend, city =', current.city);
    await postPushToken({
      token: current.expoPushToken,
      platform: Platform.OS === 'android' ? 'android' : 'ios',
      city: current.city,
      settings: toApiSettings(current.prefs),
    });
  }, []);

  const dismissSoftPrompt = useCallback((): void => {
    console.log('[push] User dismissed soft prompt');
    persist({ ...stateRef.current, status: 'softDismissed' });
  }, [persist]);

  /**
   * Показывает системный диалог iOS. После отказа повторно НЕ просим,
   * настройки автоматически НЕ открываем (Guideline 5.1.1).
   */
  const requestSystemPermission = useCallback(async (): Promise<NotificationPermissionStatus> => {
    console.log('[push] === requestSystemPermission START ===');
    if (Platform.OS !== 'ios') {
      console.log('[push] Not iOS, setting status to denied');
      persist({ ...stateRef.current, status: 'denied' });
      return 'denied';
    }
    setRequesting(true);
    try {
      // Шаг 1: проверяем текущий статус разрешений
      const existing = await Notifications.getPermissionsAsync();
      console.log('[push] Step 1 - Current permission status:', existing.status, existing);

      let status = existing.status;

      // Шаг 2: запрашиваем разрешение, если ещё не granted
      if (status !== 'granted') {
        console.log('[push] Step 2 - Requesting notification permissions');
        const req = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
        console.log('[push] Step 2 - requestPermissionsAsync result:', req.status, req);
        status = req.status;
      } else {
        console.log('[push] Step 2 - Permission already granted, skipping request');
      }

      const finalStatus: 'granted' | 'denied' = status === 'granted' ? 'granted' : 'denied';
      console.log('[push] Step 3 - Final permission status:', finalStatus);

      let token: string | null = null;

      if (finalStatus === 'granted' && Device.isDevice) {
        console.log('[push] Step 4 - Device is physical, requesting Expo push token');
        try {
          const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
          console.log('[push] Step 4 - Project ID:', projectId);
          const tokenRes = await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined,
          );
          token = tokenRes.data;
          console.log('[push] Step 4 - Expo push token obtained:', token.slice(0, 24) + '…');
        } catch (err) {
          console.error('[push] Step 4 - getExpoPushTokenAsync FAILED:', err);
        }
      } else {
        console.log('[push] Step 4 - Skip token fetch:', {
          isDevice: Device.isDevice,
          finalStatus,
          deviceName: Device.deviceName,
          modelName: Device.modelName,
        });
      }

      const next: PersistedState = {
        ...stateRef.current,
        status: finalStatus,
        expoPushToken: token ?? stateRef.current.expoPushToken,
      };
      console.log('[push] Step 5 - Persisting state:', {
        status: next.status,
        hasToken: !!next.expoPushToken,
        tokenPreview: next.expoPushToken ? next.expoPushToken.slice(0, 24) + '…' : null,
        city: next.city,
      });
      persist(next);

      if (finalStatus === 'granted' && next.expoPushToken) {
        console.log('[push] Step 6 - Syncing to backend after permission grant');
        void sync(next);
      } else {
        console.log('[push] Step 6 - Skip sync:', {
          finalStatus,
          hasToken: !!next.expoPushToken,
        });
      }

      console.log('[push] === requestSystemPermission END, returning:', finalStatus);
      return finalStatus;
    } catch (err) {
      console.error('[push] requestSystemPermission CRASHED:', err);
      const next: PersistedState = {
        ...stateRef.current,
        status: 'denied' as const,
      };
      persist(next);
      return 'denied';
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
      console.log('[push] setPref:', key, '=', value, '| city =', next.city);
      persist(next);
      void sync(next);
    },
    [persist, sync],
  );

  const setCity = useCallback(
    (city: string | null): void => {
      if (stateRef.current.city === city) return;
      console.log('[push] setCity: changed from', stateRef.current.city, 'to', city);
      const next: PersistedState = { ...stateRef.current, city };
      persist(next);
      void sync(next);
    },
    [persist, sync],
  );

  const syncToBackend = useCallback(async (): Promise<void> => {
    console.log('[push] syncToBackend: manual sync trigger');
    await sync();
  }, [sync]);

  const shouldShowSoftPrompt = useMemo<boolean>(
    () => hydrated && Platform.OS === 'ios' && state.status === 'undetermined',
    [hydrated, state.status],
  );

  console.log('[push] useNotifications render:', {
    hydrated,
    requesting,
    status: state.status,
    hasToken: !!state.expoPushToken,
    city: state.city,
    shouldShowSoftPrompt,
  });

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
