import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { upsertPushToken } from '@/services/pushTokens';
import { isSupabaseConfigured } from '@/services/supabase';

const STORAGE_KEY = 'notifications-state-v1';
const DEFAULT_CITY = 'Барнаул';

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

const toApiSettings = (prefs: NotificationPrefs) => ({
  priceIncrease: prefs.priceUp,
  priceDecrease: prefs.priceDown,
  requestStatus: prefs.requestStatus,
  companyNews: prefs.companyNews,
});

/**
 * Отправка токена и настроек в Supabase (таблица push_tokens).
 * Все ошибки логируются в console.error.
 */
const postPushToken = async (
  token: string,
  platform: 'ios' | 'android',
  city: string | null,
  prefs: NotificationPrefs,
): Promise<boolean> => {
  console.log('[push] === postPushToken START ===');
  console.log('[push] Supabase configured:', isSupabaseConfigured);
  console.log('[push] token:', token.slice(0, 24) + '…');
  console.log('[push] platform:', platform);
  console.log('[push] city being saved:', city ?? '<null>, using default: ' + DEFAULT_CITY);
  console.log('[push] settings:', toApiSettings(prefs));

  const result = await upsertPushToken({
    token,
    platform,
    city: city ?? DEFAULT_CITY,
    priceIncrease: prefs.priceUp,
    priceDecrease: prefs.priceDown,
    requestStatus: prefs.requestStatus,
    companyNews: prefs.companyNews,
  });

  console.log('[push] upsertPushToken result:', result);
  console.log('[push] === postPushToken END ===');
  return result;
};

// Настройка обработчика входящих уведомлений (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Управление push-уведомлениями.
 *
 * При старте приложения АГРЕССИВНО:
 * 1. Проверяет статус разрешений
 * 2. Если undetermined — запрашивает системное разрешение
 * 3. После получения разрешения — получает Expo Push Token
 * 4. Сохраняет токен в Supabase (город по умолчанию "Барнаул")
 *
 * Соответствует Apple Guideline 5.1.1: после отказа не показываем
 * повторных popup, не открываем настройки iOS автоматически.
 */
export const [NotificationsProvider, useNotifications] = createContextHook(() => {
  const [state, setState] = useState<PersistedState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [requesting, setRequesting] = useState<boolean>(false);
  const stateRef = useRef<PersistedState>(DEFAULT_STATE);
  const registeredRef = useRef<boolean>(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── Загрузка сохранённого состояния из AsyncStorage ──
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
          console.log('[push] Loaded persisted state:', {
            status: next.status,
            hasToken: !!next.expoPushToken,
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

  // ── АГРЕССИВНАЯ РЕГИСТРАЦИЯ ПРИ СТАРТЕ ПРИЛОЖЕНИЯ ──
  useEffect(() => {
    if (!hydrated) return;
    if (registeredRef.current) return;
    registeredRef.current = true;

    const registerOnStartup = async (): Promise<void> => {
      console.log('[push] === AGRESSIVE STARTUP REGISTRATION ===');
      console.log('[push] isSupabaseConfigured:', isSupabaseConfigured);

      if (!isSupabaseConfigured) {
        console.warn('[push] Supabase is NOT configured — abort startup registration');
        return;
      }

      // Шаг 1: проверяем текущий статус разрешений
      const existing = await Notifications.getPermissionsAsync();
      console.log('[push] Step 1 — current permission status:', existing.status, existing);

      let permStatus = existing.status;

      // Шаг 2: если undetermined — запрашиваем разрешение
      if (permStatus !== 'granted') {
        console.log('[push] Step 2 — requesting notification permissions (status:', permStatus, ')');
        const req = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
        console.log('[push] Step 2 — requestPermissionsAsync result:', req.status, req);
        permStatus = req.status;
      } else {
        console.log('[push] Step 2 — permission already granted, skipping request');
      }

      // Шаг 3: получаем Expo Push Token если granted и физическое устройство
      let token: string | null = null;
      if (permStatus === 'granted') {
        console.log('[push] Step 3 — permission granted, getting Expo push token');
        console.log('[push] Step 3 — Device.isDevice:', Device.isDevice, '| model:', Device.modelName);

        try {
          const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
          console.log('[push] Step 3 — projectId from Constants.expoConfig.extra.eas.projectId:', projectId);
          if (!projectId) {
            console.error('[push] Step 3 — NO projectId found in Constants.expoConfig.extra.eas.projectId. Push token will fail.');
          }
          const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
          token = tokenRes.data;
          console.log('[push] Step 3 — Expo push token:', token.slice(0, 24) + '…');
          console.log('[push] Step 3 — token type:', tokenRes.type);
        } catch (err) {
          console.error('[push] Step 3 — getExpoPushTokenAsync FAILED:', err);
        }
      } else {
        console.log('[push] Step 3 — permission NOT granted (', permStatus, '), skipping token fetch');
      }

      // Шаг 4: сохраняем токен в Supabase
      if (permStatus === 'granted' && token) {
        console.log('[push] Step 4 — saving token to Supabase');
        const currentCity = stateRef.current.city;
        console.log('[push] Step 4 — city from state:', currentCity ?? '<null>, will use default:', DEFAULT_CITY);

        const saved = await postPushToken(
          token,
          Platform.OS === 'android' ? 'android' : 'ios',
          currentCity,
          stateRef.current.prefs,
        );
        console.log('[push] Step 4 — token save result:', saved);

        // Обновляем persisted state с новым токеном
        const next: PersistedState = {
          ...stateRef.current,
          status: 'granted',
          expoPushToken: token,
        };
        persistInternal(next);
      } else {
        console.log('[push] Step 4 — skip token save:', {
          permStatus,
          hasToken: !!token,
          reason: !token ? 'no token' : 'not granted',
        });
        // Всё равно обновляем статус в persisted state
        const finalStatus: NotificationPermissionStatus =
          permStatus === 'granted' ? 'granted' : 'denied';
        const next: PersistedState = {
          ...stateRef.current,
          status: finalStatus,
          expoPushToken: token ?? stateRef.current.expoPushToken,
        };
        persistInternal(next);
      }

      console.log('[push] === STARTUP REGISTRATION COMPLETE ===');
    };

    void registerOnStartup();
  }, [hydrated]);

  const persistInternal = (next: PersistedState): void => {
    stateRef.current = next;
    setState(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((err) => {
      console.error('[push] Failed to persist state to AsyncStorage:', err);
    });
  };

  const persist = useCallback((next: PersistedState): void => {
    persistInternal(next);
  }, []);

  const sync = useCallback(async (override?: Partial<PersistedState>): Promise<void> => {
    const current: PersistedState = { ...stateRef.current, ...(override ?? {}) };
    if (!current.expoPushToken) {
      console.log('[push] sync: no token yet, skip');
      return;
    }
    console.log('[push] sync: sending token to backend, city =', current.city ?? DEFAULT_CITY);
    await postPushToken(
      current.expoPushToken,
      Platform.OS === 'android' ? 'android' : 'ios',
      current.city,
      current.prefs,
    );
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
    console.log('[push] === requestSystemPermission (manual trigger) ===');
    if (Platform.OS !== 'ios') {
      console.log('[push] Not iOS, setting status to denied');
      persist({ ...stateRef.current, status: 'denied' });
      return 'denied';
    }
    setRequesting(true);
    try {
      const existing = await Notifications.getPermissionsAsync();
      console.log('[push] Manual — current permission status:', existing.status);

      let status = existing.status;

      if (status !== 'granted') {
        console.log('[push] Manual — requesting notification permissions');
        const req = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
        console.log('[push] Manual — requestPermissionsAsync result:', req.status);
        status = req.status;
      }

      const finalStatus: 'granted' | 'denied' = status === 'granted' ? 'granted' : 'denied';
      console.log('[push] Manual — final permission status:', finalStatus);

      let token: string | null = null;

      if (finalStatus === 'granted') {
        try {
          const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
          console.log('[push] Manual — projectId from Constants:', projectId);
          const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
          token = tokenRes.data;
          console.log('[push] Manual — Expo push token:', token.slice(0, 24) + '…');
          console.log('[push] Manual — token type:', tokenRes.type);
        } catch (err) {
          console.error('[push] Manual — getExpoPushTokenAsync FAILED:', err);
        }
      }

      const next: PersistedState = {
        ...stateRef.current,
        status: finalStatus,
        expoPushToken: token ?? stateRef.current.expoPushToken,
      };
      persist(next);

      if (finalStatus === 'granted' && next.expoPushToken) {
        console.log('[push] Manual — syncing to backend');
        // After the Platform.OS !== 'ios' guard above, we know this is iOS
        await postPushToken(next.expoPushToken, 'ios', next.city, next.prefs);
      }

      return finalStatus;
    } catch (err) {
      console.error('[push] Manual — requestSystemPermission CRASHED:', err);
      persist({ ...stateRef.current, status: 'denied' });
      return 'denied';
    } finally {
      setRequesting(false);
    }
  }, [persist]);

  const setPref = useCallback(
    (key: NotificationCategory, value: boolean): void => {
      const next: PersistedState = {
        ...stateRef.current,
        prefs: { ...stateRef.current.prefs, [key]: value },
      };
      console.log('[push] setPref:', key, '=', value, '| city =', next.city ?? DEFAULT_CITY);
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
