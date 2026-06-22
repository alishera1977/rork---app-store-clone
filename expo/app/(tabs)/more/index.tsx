import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Switch,
} from 'react-native';
import {
  Phone,
  Globe,
  Briefcase,
  ChevronRight,
  MapPin,
  FileText,
  Shield,
  Info,
  ChevronDown,
  ChevronUp,
  Moon,
  Sun,
  TrendingUp,
  TrendingDown,
  Truck,
  Megaphone,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';

import { AppColors } from '@/constants/colors';
import { useAppTheme } from '@/hooks/useAppTheme';
import { fetchVacancies, fetchSettings } from '@/services/api';
import { useNotifications, NotificationCategory } from '@/hooks/useNotifications';
import PushDebugPanel from '@/components/PushDebugPanel';

export default function MoreScreen() {
  const { colors: Colors, themeMode, setThemeMode } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [expandedVacancy, setExpandedVacancy] = useState<string | null>(null);
  const {
    status: notifStatus,
    prefs: notifPrefs,
    setPref: setNotifPref,
    requestSystemPermission,
    requesting: notifRequesting,
  } = useNotifications();

  const onTogglePref = useCallback(
    async (key: NotificationCategory, value: boolean) => {
      if (Platform.OS !== 'web') void Haptics.selectionAsync();
      if (value && notifStatus !== 'granted') {
        const result = await requestSystemPermission();
        if (result !== 'granted') return;
      }
      setNotifPref(key, value);
    },
    [notifStatus, requestSystemPermission, setNotifPref],
  );

  const notifEnabled = notifStatus === 'granted';
  const notifItems: { key: NotificationCategory; title: string; desc: string; icon: React.ReactNode; bg: string }[] = [
    {
      key: 'priceUp',
      title: 'Повышение цен',
      desc: 'Уведомления при повышении цен на металл',
      icon: <TrendingUp size={18} color={Colors.success} />,
      bg: Colors.successBg,
    },
    {
      key: 'priceDown',
      title: 'Понижение цен',
      desc: 'Уведомления при снижении цен на металл',
      icon: <TrendingDown size={18} color={Colors.danger} />,
      bg: Colors.dangerBg,
    },
    {
      key: 'requestStatus',
      title: 'Статус заявки',
      desc: 'Изменения статуса заявки на вывоз',
      icon: <Truck size={18} color={Colors.accent} />,
      bg: Colors.accentBg,
    },
    {
      key: 'companyNews',
      title: 'Новости компании',
      desc: 'Новости, акции и важные обновления',
      icon: <Megaphone size={18} color={Colors.primary} />,
      bg: Colors.primaryBg,
    },
  ];

  const vacanciesQuery = useQuery({
    queryKey: ['vacancies'],
    queryFn: fetchVacancies,
    staleTime: 10 * 60 * 1000,
  });

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 10 * 60 * 1000,
  });

  const vacancies = vacanciesQuery.data ?? [];
  const settings = settingsQuery.data;
  const phone = settings?.phone ?? '+7 (905) 982-39-45';
  const website = settings?.website ?? 'https://xn--80ajscakgeerhe.xn--p1ai/';
  const companyName = settings?.companyName ?? 'Промметпласт Группа компаний';

  const handleLink = useCallback((url: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Linking.openURL(url);
  }, []);

  const toggleVacancy = useCallback((id: string) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setExpandedVacancy(prev => prev === id ? null : id);
  }, []);

  const handleRefresh = useCallback(() => {
    vacanciesQuery.refetch();
    settingsQuery.refetch();
  }, [vacanciesQuery, settingsQuery]);

  const handleThemeSelect = useCallback((mode: 'dark' | 'light') => {
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync();
    }
    setThemeMode(mode);
  }, [setThemeMode]);

  const isRefreshing = vacanciesQuery.isRefetching || settingsQuery.isRefetching;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <View style={styles.aboutCard}>
          <View style={styles.aboutHeader}>
            <View style={styles.aboutLogoWrap}>
              <Text style={styles.aboutLogoText}>П</Text>
            </View>
            <View style={styles.aboutInfo}>
              <Text style={styles.aboutTitle}>{companyName}</Text>
              <Text style={styles.aboutSubtitle}>Скупка чёрного и цветного лома</Text>
            </View>
          </View>
          <Text style={styles.aboutDescription}>
            Принимаем металлолом в Алтайском крае и Новосибирской области. 
            Честные цены, точный вес, самовывоз от {settings?.minPickupWeight ?? '500'} кг. 
            Работаем с физическими и юридическими лицами.
          </Text>
        </View>

        <View style={styles.sectionLabel}>
          <Text style={styles.sectionTitle}>Контакты</Text>
        </View>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleLink(`tel:${phone.replace(/[^+\d]/g, '')}`)}
          activeOpacity={0.7}
          testID="contact-phone"
        >
          <View style={[styles.menuIcon, { backgroundColor: Colors.successBg }]}>
            <Phone size={18} color={Colors.success} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>Телефон</Text>
            <Text style={styles.menuValue}>{phone}</Text>
          </View>
          <ChevronRight size={18} color={Colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleLink(website)}
          activeOpacity={0.7}
          testID="contact-website"
        >
          <View style={[styles.menuIcon, { backgroundColor: Colors.accentBg }]}>
            <Globe size={18} color={Colors.accent} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>Сайт</Text>
            <Text style={styles.menuValue}>{website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</Text>
          </View>
          <ChevronRight size={18} color={Colors.textTertiary} />
        </TouchableOpacity>

        <View style={styles.sectionLabel}>
          <Text style={styles.sectionTitle}>Вакансии</Text>
          {vacancies.length > 0 && (
            <View style={styles.vacancyBadge}>
              <Text style={styles.vacancyBadgeText}>{vacancies.length}</Text>
            </View>
          )}
        </View>

        {vacanciesQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : vacancies.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Нет открытых вакансий</Text>
          </View>
        ) : (
          vacancies.map((vacancy) => {
            const isExpanded = expandedVacancy === vacancy.id;
            return (
              <TouchableOpacity
                key={vacancy.id}
                style={styles.vacancyCard}
                onPress={() => toggleVacancy(vacancy.id)}
                activeOpacity={0.7}
                testID={`vacancy-${vacancy.id}`}
              >
                <View style={styles.vacancyHeader}>
                  <View style={[styles.menuIcon, { backgroundColor: Colors.primaryBg }]}>
                    <Briefcase size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.vacancyInfo}>
                    <Text style={styles.vacancyTitle}>{vacancy.title}</Text>
                    <View style={styles.vacancyMeta}>
                      <MapPin size={12} color={Colors.textTertiary} />
                      <Text style={styles.vacancyLocation}>{vacancy.location}</Text>
                    </View>
                  </View>
                  {isExpanded ? (
                    <ChevronUp size={18} color={Colors.textTertiary} />
                  ) : (
                    <ChevronDown size={18} color={Colors.textTertiary} />
                  )}
                </View>
                {isExpanded && (
                  <View style={styles.vacancyDetails}>
                    <Text style={styles.vacancyDesc}>{vacancy.description}</Text>
                    {vacancy.requirements.length > 0 && (
                      <>
                        <Text style={styles.requirementsTitle}>Требования:</Text>
                        {vacancy.requirements.map((req, i) => (
                          <View key={i} style={styles.requirementRow}>
                            <View style={styles.bulletDot} />
                            <Text style={styles.requirementText}>{req}</Text>
                          </View>
                        ))}
                      </>
                    )}
                    <TouchableOpacity
                      style={styles.applyButton}
                      onPress={() => handleLink(`tel:${phone.replace(/[^+\d]/g, '')}`)}
                      activeOpacity={0.7}
                    >
                      <Phone size={14} color={Colors.primary} />
                      <Text style={styles.applyButtonText}>Позвонить</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}

        <View style={styles.sectionLabel}>
          <Text style={styles.sectionTitle}>Оформление</Text>
        </View>

        <View style={styles.themeCard}>
          <TouchableOpacity
            style={[styles.themeOption, themeMode === 'dark' && styles.themeOptionActive]}
            onPress={() => handleThemeSelect('dark')}
            activeOpacity={0.75}
            testID="theme-dark"
          >
            <Moon size={18} color={themeMode === 'dark' ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.themeOptionText, themeMode === 'dark' && styles.themeOptionTextActive]}>
              Тёмная
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.themeOption, themeMode === 'light' && styles.themeOptionActive]}
            onPress={() => handleThemeSelect('light')}
            activeOpacity={0.75}
            testID="theme-light"
          >
            <Sun size={18} color={themeMode === 'light' ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.themeOptionText, themeMode === 'light' && styles.themeOptionTextActive]}>
              Светлая
            </Text>
          </TouchableOpacity>
        </View>

        {Platform.OS === 'ios' && (
          <>
            <View style={styles.sectionLabel}>
              <Text style={styles.sectionTitle}>Уведомления</Text>
            </View>

            {notifItems.map((item) => {
              const value = notifEnabled && notifPrefs[item.key];
              return (
                <View key={item.key} style={styles.menuItem} testID={`notif-${item.key}`}>
                  <View style={[styles.menuIcon, { backgroundColor: item.bg }]}>
                    {item.icon}
                  </View>
                  <View style={styles.menuContent}>
                    <Text style={styles.menuLabel}>{item.title}</Text>
                    <Text style={styles.menuValue}>{item.desc}</Text>
                  </View>
                  <Switch
                    value={value}
                    onValueChange={(v) => { void onTogglePref(item.key, v); }}
                    disabled={notifRequesting}
                    trackColor={{ false: Colors.border, true: Colors.primary }}
                    thumbColor={Platform.OS === 'android' ? (value ? Colors.bg : Colors.bgCardElevated) : undefined}
                    ios_backgroundColor={Colors.border}
                  />
                </View>
              );
            })}

            {notifStatus === 'denied' && (
              <Text style={styles.notifHint}>
                Уведомления отключены. Включить их можно в системных настройках устройства.
              </Text>
            )}
          </>
        )}

        {/* ── Debug Panel (временный) ── */}
        {Platform.OS === 'ios' && (
          <PushDebugPanel />
        )}

        <View style={styles.sectionLabel}>
          <Text style={styles.sectionTitle}>Информация</Text>
        </View>

        <View style={styles.menuItem}>
          <View style={[styles.menuIcon, { backgroundColor: Colors.dangerBg }]}>
            <FileText size={18} color={Colors.danger} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>Важно</Text>
            <Text style={styles.menuValue}>Расчёты только безнал (ФЗ №306)</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleLink('https://xn--80ajscakgeerhe.xn--p1ai/privacy-policy/')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIcon, { backgroundColor: 'rgba(139, 146, 160, 0.1)' }]}>
            <Shield size={18} color={Colors.textSecondary} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>Политика конфиденциальности</Text>
            <Text style={styles.menuValue}>Обработка персональных данных</Text>
          </View>
          <ChevronRight size={18} color={Colors.textTertiary} />
        </TouchableOpacity>

        <View style={styles.footer}>
          <Info size={14} color={Colors.textTertiary} />
          <Text style={styles.footerText}>
            Версия 1.0.0 • {companyName} © 2024
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (Colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    paddingTop: 8,
  },
  aboutCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  aboutLogoWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutLogoText: {
    fontSize: 22,
    fontWeight: '900' as const,
    color: Colors.bg,
  },
  aboutInfo: {
    flex: 1,
  },
  aboutTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  aboutSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  aboutDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  vacancyBadge: {
    backgroundColor: Colors.primaryBg,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  vacancyBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  themeCard: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
  },
  themeOptionActive: {
    backgroundColor: Colors.primaryBg,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  themeOptionText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
  },
  themeOptionTextActive: {
    color: Colors.primary,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  menuValue: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  vacancyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  vacancyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vacancyInfo: {
    flex: 1,
  },
  vacancyTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  vacancyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  vacancyLocation: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  vacancyDetails: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  vacancyDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.primary,
  },
  requirementText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primaryBg,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E8A83825',
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 32,
    paddingVertical: 8,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  notifHint: {
    fontSize: 12,
    color: Colors.textTertiary,
    paddingHorizontal: 6,
    marginTop: 4,
    lineHeight: 18,
  },
});
