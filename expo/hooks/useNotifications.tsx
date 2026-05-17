import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

const STORAGE_KEY = 'notifications-state-v1';

export type NotificationCategory =
  | 'priceUp'
  | 'priceDown'
  | 'requestStatus'
  | 'companyNews';

export type NotificationPrefs = Record<NotificationCategory, boolean>;

export type NotificationPermissionStatus =
  | 'undetermined' // ещё не спрашивали
  | 'softDismissed' // пользователь нажал «Позже» во внутреннем баннере
  | 'granted' // системное разрешение получено
  | 'denied'; // системное разрешение отклонено

interface PersistedState {
  status: NotificationPermissionStatus;
  prefs: NotificationPrefs;
  expoPushToken: string | null;
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
};

/**
 * Управление push-уведомлениями (только iOS).
 *
 * Сейчас в Expo Go нативный модуль `expo-notifications` недоступен,
 * поэтому реальный системный запрос разрешения и получение Expo Push Token
 * подключаются на этапе production-сборки. Этот хук уже хранит статус,
 * настройки по категориям и токен в AsyncStorage и предоставляет API
 * (`requestSystemPermission`), куда останется добавить пару строк
 * `Notifications.requestPermissionsAsync()` / `getExpoPushTokenAsync()`.
 *
 * Соответствует Apple Guideline 5.1.1: повторно после отказа пользователь
 * не беспокоится, навязчивые popup'ы и автоматический openSettings отсутствуют.
 */
export const [NotificationsProvider, useNotifications] = createContextHook(() => {
  const [state, setState] = useState<PersistedState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [requesting, setRequesting] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    const load = async (): Promise<void> => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (mounted && raw) {
          const parsed = JSON.parse(raw) as Partial<PersistedState>;
          setState({
            status: parsed.status ?? 'undetermined',
            prefs: { ...DEFAULT_PREFS, ...(parsed.prefs ?? {}) },
            expoPushToken: parsed.expoPushToken ?? null,
          });
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
    setState(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  /** Вызывается, когда пользователь нажал «Позже» в мягком баннере. */
  const dismissSoftPrompt = useCallback((): void => {
    persist({ ...state, status: 'softDismissed' });
  }, [persist, state]);

  /**
   * Показывает системный диалог iOS. После отказа повторно НЕ просим,
   * настройки автоматически НЕ открываем (Guideline 5.1.1).
   */
  const requestSystemPermission = useCallback(async (): Promise<NotificationPermissionStatus> => {
    if (Platform.OS !== 'ios') {
      const next: PersistedState = { ...state, status: 'denied' };
      persist(next);
      return 'denied';
    }
    setRequesting(true);
    try {
      // ── Production: раскомментировать после установки expo-notifications ──
      // const Notifications = await import('expo-notifications');
      // const Device = await import('expo-device');
      // const { status: existing } = await Notifications.getPermissionsAsync();
      // let finalStatus = existing;
      // if (existing !== 'granted') {
      //   const { status } = await Notifications.requestPermissionsAsync({
      //     ios: { allowAlert: true, allowBadge: true, allowSound: true },
      //   });
      //   finalStatus = status;
      // }
      // let token: string | null = null;
      // if (finalStatus === 'granted' && Device.isDevice) {
      //   const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
      //   const tokenRes = await Notifications.getExpoPushTokenAsync(
      //     projectId ? { projectId } : undefined,
      //   );
      //   token = tokenRes.data;
      // }
      // const nextStatus: NotificationPermissionStatus =
      //   finalStatus === 'granted' ? 'granted' : 'denied';
      // const next: PersistedState = { ...state, status: nextStatus, expoPushToken: token };
      // persist(next);
      // return nextStatus;

      // ── Expo Go fallback: помечаем как granted, но без реального токена ──
      const next: PersistedState = { ...state, status: 'granted', expoPushToken: null };
      persist(next);
      return 'granted';
    } catch {
      const next: PersistedState = { ...state, status: 'denied' };
      persist(next);
      return 'denied';
    } finally {
      setRequesting(false);
    }
  }, [persist, state]);

  const setPref = useCallback(
    (key: NotificationCategory, value: boolean): void => {
      persist({ ...state, prefs: { ...state.prefs, [key]: value } });
    },
    [persist, state],
  );

  /**
   * Заглушка под будущий backend — токен и настройки готовы к отправке.
   * Подключить, когда появится endpoint регистрации устройств.
   */
  const syncToBackend = useCallback(async (): Promise<void> => {
    if (!state.expoPushToken) return;
    // await fetch('/api/devices/register', { method: 'POST', body: JSON.stringify({
    //   token: state.expoPushToken, platform: 'ios', prefs: state.prefs,
    // })});
  }, [state]);

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
    shouldShowSoftPrompt,
    dismissSoftPrompt,
    requestSystemPermission,
    setPref,
    syncToBackend,
  };
});
