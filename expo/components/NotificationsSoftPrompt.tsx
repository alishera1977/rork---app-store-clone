import React, { useCallback, useMemo } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useNotifications } from '@/hooks/useNotifications';
import { AppColors } from '@/constants/colors';

/**
 * Мягкий внутренний экран запроса уведомлений.
 * Системный диалог iOS показывается ТОЛЬКО после явного согласия здесь.
 * После «Позже» или отказа повторно не появляется (Guideline 5.1.1).
 */
export default function NotificationsSoftPrompt() {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const {
    shouldShowSoftPrompt,
    requestSystemPermission,
    dismissSoftPrompt,
    requesting,
  } = useNotifications();

  const onAllow = useCallback(async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await requestSystemPermission();
  }, [requestSystemPermission]);

  const onLater = useCallback(() => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    dismissSoftPrompt();
  }, [dismissSoftPrompt]);

  if (!shouldShowSoftPrompt) return null;

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Bell size={28} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Уведомления</Text>
          <Text style={styles.subtitle}>
            Хотите получать уведомления об изменении цен на металл и статусе ваших заявок?
          </Text>

          <View style={styles.bullets}>
            <Text style={styles.bullet}>• Повышение и понижение цен</Text>
            <Text style={styles.bullet}>• Статус заявки на вывоз</Text>
            <Text style={styles.bullet}>• Новости и акции компании</Text>
          </View>

          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, requesting && styles.btnDisabled]}
            onPress={onAllow}
            disabled={requesting}
            activeOpacity={0.85}
            testID="notif-allow"
          >
            <Text style={styles.btnPrimaryText}>Разрешить уведомления</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnGhost]}
            onPress={onLater}
            disabled={requesting}
            activeOpacity={0.7}
            testID="notif-later"
          >
            <Text style={styles.btnGhostText}>Позже</Text>
          </TouchableOpacity>

          <Text style={styles.note}>
            Настроить типы уведомлений можно в разделе «Ещё».
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (Colors: AppColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: Colors.bgCard,
      borderRadius: 22,
      padding: 24,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: Colors.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    title: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: Colors.text,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
      marginBottom: 14,
    },
    bullets: {
      gap: 4,
      marginBottom: 18,
    },
    bullet: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    btn: {
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPrimary: {
      backgroundColor: Colors.primary,
      marginBottom: 8,
    },
    btnPrimaryText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700' as const,
    },
    btnGhost: {
      backgroundColor: 'transparent',
    },
    btnGhostText: {
      color: Colors.textSecondary,
      fontSize: 14,
      fontWeight: '600' as const,
    },
    btnDisabled: {
      opacity: 0.6,
    },
    note: {
      fontSize: 12,
      color: Colors.textTertiary,
      textAlign: 'center' as const,
      marginTop: 6,
    },
  });
