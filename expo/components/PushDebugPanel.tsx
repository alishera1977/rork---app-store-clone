import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import { upsertPushToken } from '@/services/pushTokens';
import { useNotifications } from '@/hooks/useNotifications';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { AppColors } from '@/constants/colors';

type TestState = {
  running: boolean;
  step: string;
  permissionStatus: string;
  permRequestResult: string;
  projectId: string;
  pushToken: string;
  savePayload: string;
  saveResult: string;
  saveError: string;
  finished: boolean;
};

const INITIAL_TEST: TestState = {
  running: false,
  step: '',
  permissionStatus: '',
  permRequestResult: '',
  projectId: '',
  pushToken: '',
  savePayload: '',
  saveResult: '',
  saveError: '',
  finished: false,
};

const DEFAULT_CITY = 'Барнаул';

export default function PushDebugPanel() {
  const { colors: Colors } = useAppTheme();
  const styles = createStyles(Colors);
  const notif = useNotifications();
  const [test, setTest] = useState<TestState>(INITIAL_TEST);
  const [expanded, setExpanded] = useState<boolean>(false);

  // ── Read env at render time ──
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const projectId = process.env.EXPO_PUBLIC_PROJECT_ID ?? '';

  const hasUrl = Boolean(supabaseUrl);
  const hasKey = Boolean(supabaseKey);
  const supabaseClient = getSupabase();
  const supabaseReady = supabaseClient !== null;

  // ── "Test save push token" button ──
  const handleTest = useCallback(async () => {
    const t: TestState = { ...INITIAL_TEST, running: true };
    setTest(t);

    const update = (patch: Partial<TestState>) => {
      tCopy = { ...tCopy, ...patch };
      setTest(tCopy);
    };
    let tCopy = { ...t };

    // Step 1 — env check
    update({ step: 'Проверка переменных окружения…' });
    if (!hasUrl || !hasKey) {
      update({
        step: '',
        saveError: `Supabase не настроен. URL: ${hasUrl}, Key: ${hasKey}`,
        running: false,
        finished: true,
      });
      return;
    }

    // Step 2 — permission check
    update({ step: 'Проверка разрешений уведомлений…' });
    const existing = await Notifications.getPermissionsAsync();
    update({ permissionStatus: existing.status });

    let permStatus = existing.status;
    if (permStatus !== 'granted') {
      update({ step: 'Запрос разрешения уведомлений…' });
      const req = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      update({ permRequestResult: req.status });
      permStatus = req.status;
    }

    if (permStatus !== 'granted') {
      update({
        step: '',
        saveError: `Разрешение не получено (статус: ${permStatus}). Перейдите в Настройки iOS → Промметпласт → Уведомления и включите их вручную.`,
        running: false,
        finished: true,
      });
      return;
    }

    // Step 3 — get Expo push token
    update({ step: 'Получение Expo Push Token…' });
    update({ projectId });
    try {
      const tokenRes = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      update({ pushToken: tokenRes.data });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      update({
        step: '',
        saveError: `getExpoPushTokenAsync FAILED: ${msg}`,
        running: false,
        finished: true,
      });
      return;
    }

    // Step 4 — save to Supabase
    update({ step: 'Сохранение токена в Supabase push_tokens…' });

    const city = notif.city ?? DEFAULT_CITY;
    const platform: 'ios' | 'android' =
      Platform.OS === 'android' ? 'android' : 'ios';

    const payload = {
      token: tCopy.pushToken,
      platform,
      city,
      priceIncrease: notif.prefs.priceUp,
      priceDecrease: notif.prefs.priceDown,
      requestStatus: notif.prefs.requestStatus,
      companyNews: notif.prefs.companyNews,
    };

    update({
      savePayload: JSON.stringify(
        {
          ...payload,
          token: payload.token.slice(0, 24) + '…',
          supabaseUrl: supabaseUrl.slice(0, 40) + '…',
        },
        null,
        2,
      ),
    });

    // Direct Supabase upsert with raw error capture
    const sb = getSupabase();
    if (!sb) {
      update({
        saveError: 'getSupabase() вернул null — клиент Supabase не инициализирован.',
        saveResult: 'FAIL',
        running: false,
        finished: true,
      });
      return;
    }

    try {
      const { error, status, statusText } = await sb
        .from('push_tokens')
        .upsert(
          {
            token: payload.token,
            platform: payload.platform,
            city: payload.city,
            price_increase: payload.priceIncrease,
            price_decrease: payload.priceDecrease,
            request_status: payload.requestStatus,
            company_news: payload.companyNews,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'token' },
        );

      if (error) {
        update({
          saveError: `Supabase error: ${error.message} | code: ${error.code ?? '-'} | details: ${error.details ?? '-'} | hint: ${error.hint ?? '-'}`,
          saveResult: `HTTP ${status} ${statusText ?? ''}`,
          running: false,
          finished: true,
        });
        return;
      }

      update({
        saveResult: `Успешно! HTTP ${status} ${statusText ?? ''}. Токен сохранён в push_tokens.`,
        step: '',
        running: false,
        finished: true,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      update({
        saveError: `Исключение при upsert: ${msg}`,
        saveResult: 'CRASH',
        running: false,
        finished: true,
      });
    }
  }, [hasUrl, hasKey, projectId, supabaseUrl, notif.city, notif.prefs]);

  if (!expanded) {
    return (
      <TouchableOpacity
        style={styles.debugToggle}
        onPress={() => setExpanded(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.debugToggleText}>🔧 Push Debug Panel</Text>
        <Text style={styles.debugToggleHint}>Нажмите чтобы открыть</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => setExpanded(false)}
        activeOpacity={0.7}
      >
        <Text style={styles.closeButtonText}>Закрыть отладку</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        <Text style={styles.title}>Push Notification Debug</Text>

        {/* ── Live Diagnostics ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Окружение</Text>
          <Row label="Supabase URL задан" value={hasUrl ? '✅ true' : '❌ false'} styles={styles} error={!hasUrl} />
          <Row label="Supabase Key задан" value={hasKey ? '✅ true' : '❌ false'} styles={styles} error={!hasKey} />
          <Row label="isSupabaseConfigured" value={isSupabaseConfigured ? 'true' : 'false'} styles={styles} error={!isSupabaseConfigured} />
          <Row label="getSupabase()" value={supabaseReady ? `✅ client created` : '❌ NULL'} styles={styles} error={!supabaseReady} />
          <Row label="Expo Project ID" value={projectId || '❌ не задан'} styles={styles} error={!projectId} />
          {hasUrl && (
            <Row label="Supabase URL" value={supabaseUrl.length > 50 ? supabaseUrl.slice(0, 50) + '…' : supabaseUrl} styles={styles} />
          )}
          <Row label="Device.isDevice" value={String(Device.isDevice)} styles={styles} />
          <Row label="Device.modelName" value={Device.modelName ?? '-'} styles={styles} />
          <Row label="Platform.OS" value={Platform.OS} styles={styles} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Состояние уведомлений (из хука)</Text>
          <Row label="hydrated" value={String(notif.hydrated)} styles={styles} />
          <Row label="status" value={notif.status} styles={styles} error={notif.status !== 'granted'} />
          <Row label="Expo Push Token" value={notif.expoPushToken ? notif.expoPushToken.slice(0, 32) + '…' : '❌ null'} styles={styles} error={!notif.expoPushToken} />
          <Row label="City" value={notif.city ?? 'null (default: ' + DEFAULT_CITY + ')'} styles={styles} />
          <Row label="Prefs" value={JSON.stringify(notif.prefs)} styles={styles} />
          <Row label="Requesting" value={String(notif.requesting)} styles={styles} />
        </View>

        {/* ── Test Button ── */}
        <TouchableOpacity
          style={[styles.testButton, test.running && styles.testButtonDisabled]}
          onPress={handleTest}
          disabled={test.running}
          activeOpacity={0.7}
        >
          {test.running ? (
            <ActivityIndicator size="small" color={Colors.bg} />
          ) : (
            <Text style={styles.testButtonText}>▶ Test save push token</Text>
          )}
        </TouchableOpacity>

        {/* ── Test Results ── */}
        {test.finished || test.running ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {test.running ? 'Выполняется…' : 'Результат теста'}
            </Text>

            {test.step ? <Row label="Текущий шаг" value={test.step} styles={styles} /> : null}
            {test.projectId ? <Row label="projectId" value={test.projectId} styles={styles} /> : null}
            {test.permissionStatus ? <Row label="Статус разрешения" value={test.permissionStatus} styles={styles} /> : null}
            {test.permRequestResult ? <Row label="Результат запроса" value={test.permRequestResult} styles={styles} /> : null}
            {test.pushToken ? <Row label="Push Token" value={test.pushToken} styles={styles} /> : null}

            {test.savePayload ? (
              <View style={styles.payloadBox}>
                <Text style={styles.payloadLabel}>Upsert payload:</Text>
                <Text style={styles.payloadText} selectable>{test.savePayload}</Text>
              </View>
            ) : null}

            {test.saveResult ? (
              <Row
                label="Upsert результат"
                value={test.saveResult}
                styles={styles}
                error={!test.saveResult.includes('Успешно')}
              />
            ) : null}

            {test.saveError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>❌ Ошибка upsert:</Text>
                <Text style={styles.errorText} selectable>{test.saveError}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Quick links ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Быстрые действия</Text>
          <TouchableOpacity
            style={styles.miniButton}
            onPress={() => {
              console.log('[debug] getSupabase():', getSupabase());
              console.log('[debug] isSupabaseConfigured:', isSupabaseConfigured);
              console.log('[debug] env SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
              console.log('[debug] env SUPABASE_KEY present:', Boolean(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY));
              alert('See console for output');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.miniButtonText}>Dump env to console</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Row helper ──
function Row({
  label,
  value,
  styles,
  error,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
  error?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          error ? styles.rowValueError : null,
        ]}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

// ── Styles ──
const createStyles = (Colors: AppColors) =>
  StyleSheet.create({
    container: {
      marginTop: 8,
      marginBottom: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#EF4444',
      backgroundColor: Colors.bgCard,
      overflow: 'hidden',
    },
    scroll: {
      maxHeight: 500,
    },
    scrollContent: {
      padding: 14,
      paddingBottom: 20,
    },
    title: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: '#EF4444',
      marginBottom: 14,
    },
    closeButton: {
      alignSelf: 'flex-end',
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginTop: 8,
      marginRight: 8,
      borderRadius: 8,
      backgroundColor: '#EF444420',
    },
    closeButtonText: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: '#EF4444',
    },
    debugToggle: {
      marginTop: 8,
      marginBottom: 8,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: 'dashed' as const,
      borderColor: Colors.textTertiary,
      backgroundColor: Colors.bgCard,
      alignItems: 'center',
    },
    debugToggleText: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: Colors.textSecondary,
    },
    debugToggleHint: {
      fontSize: 11,
      color: Colors.textTertiary,
      marginTop: 2,
    },
    section: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: Colors.textSecondary,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.3,
      marginBottom: 8,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    rowLabel: {
      fontSize: 12,
      color: Colors.textTertiary,
      flex: 0,
      marginRight: 8,
    },
    rowValue: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: Colors.text,
      flex: 1,
      textAlign: 'right',
    },
    rowValueError: {
      color: '#EF4444',
      fontWeight: '600' as const,
    },
    testButton: {
      backgroundColor: '#3B82F6',
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      marginBottom: 16,
    },
    testButtonDisabled: {
      opacity: 0.6,
    },
    testButtonText: {
      fontSize: 14,
      fontWeight: '700' as const,
      color: '#FFFFFF',
    },
    miniButton: {
      backgroundColor: Colors.bgInput,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: Colors.border,
    },
    miniButtonText: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: Colors.textSecondary,
    },
    payloadBox: {
      backgroundColor: '#1A1E27',
      borderRadius: 8,
      padding: 10,
      marginTop: 6,
      borderWidth: 1,
      borderColor: '#3B82F640',
    },
    payloadLabel: {
      fontSize: 11,
      fontWeight: '600' as const,
      color: '#3B82F6',
      marginBottom: 4,
    },
    payloadText: {
      fontSize: 11,
      fontFamily: 'monospace',
      color: '#94A3B8',
    },
    errorBox: {
      backgroundColor: '#EF444415',
      borderRadius: 8,
      padding: 10,
      marginTop: 6,
      borderWidth: 1,
      borderColor: '#EF444440',
    },
    errorTitle: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: '#EF4444',
      marginBottom: 4,
    },
    errorText: {
      fontSize: 11,
      fontFamily: 'monospace',
      color: '#FCA5A5',
      lineHeight: 16,
    },
  });
