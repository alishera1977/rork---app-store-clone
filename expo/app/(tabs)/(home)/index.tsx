import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  TrendingUp,
  Truck,
  MapPin,
  Phone,
  ChevronRight,
  Flame,
  Shield,
  Clock,
  Weight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';

import { AppColors } from '@/constants/colors';
import { useAppTheme } from '@/hooks/useAppTheme';
import { fetchSettings } from '@/services/api';
import { useMetalsByCity } from '@/hooks/useMetals';

export default function HomeScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(Platform.OS === 'web' ? 1 : 0)).current;
  const slideAnim = useRef(new Animated.Value(Platform.OS === 'web' ? 0 : 30)).current;
  const [_animReady, setAnimReady] = useState(Platform.OS === 'web');

  const { metals: cityMetals, isLoading: metalsLoading, isRefetching: metalsRefetching, refetch: refetchMetals } = useMetalsByCity('1');

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 10 * 60 * 1000,
  });

  const topMetals = cityMetals
    .filter(m => m.category === 'non-ferrous' && (m.priceCardFrom50 != null || m.pricePerKg > 0))
    .slice(0, 4);

  const phone = settingsQuery.data?.phone ?? '+7 (905) 982-39-45';
  const region = settingsQuery.data?.region ?? 'Группа компаний';
  const minWeight = settingsQuery.data?.minPickupWeight ?? '500';

  useEffect(() => {
    if (Platform.OS !== 'web') {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start(() => setAnimReady(true));
    }
  }, [fadeAnim, slideAnim]);

  const handleCallPress = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    void Linking.openURL(`tel:${phone.replace(/[^+\d]/g, '')}`);
  }, [phone]);

  const handleQuickAction = useCallback((route: string) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(route as any);
  }, [router]);

  const handleRefresh = useCallback(() => {
    void refetchMetals();
    void settingsQuery.refetch();
  }, [refetchMetals, settingsQuery]);

  const isRefreshing = metalsRefetching || settingsQuery.isRefetching;

  return (
    <View style={[styles.container]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.greeting}>Промметпласт</Text>
                <Text style={styles.companyName}>{region}</Text>
              </View>
              <TouchableOpacity
                style={styles.callButton}
                onPress={handleCallPress}
                activeOpacity={0.7}
                testID="call-button"
              >
                <Phone size={18} color={Colors.bg} />
              </TouchableOpacity>
            </View>
          </View>

          <LinearGradient
            colors={['#D92D2020', '#D92D2008', 'transparent']}
            style={styles.heroBanner}
          >
            <View style={styles.heroContent}>
              <View style={styles.heroTextBlock}>
                <Text style={styles.heroTitle}>Купим ваш{'\n'}металлолом</Text>
                <Text style={styles.heroSubtitle}>
                  Самовывоз от {minWeight} кг{'\n'}Безналичный расчёт
                </Text>
              </View>
              <View style={styles.heroIconWrap}>
                <Flame size={48} color={Colors.primary} strokeWidth={1.5} />
              </View>
            </View>
            <TouchableOpacity
              style={styles.heroButton}
              onPress={() => handleQuickAction('/request')}
              activeOpacity={0.8}
              testID="hero-request-button"
            >
              <Text style={styles.heroButtonText}>Оставить заявку</Text>
              <ChevronRight size={16} color={Colors.bg} />
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => handleQuickAction('/prices')}
              activeOpacity={0.7}
              testID="quick-prices"
            >
              <View style={[styles.quickActionIcon, { backgroundColor: Colors.primaryBg }]}>
                <TrendingUp size={20} color={Colors.primary} />
              </View>
              <Text style={styles.quickActionLabel}>Прайс</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => handleQuickAction('/request')}
              activeOpacity={0.7}
              testID="quick-request"
            >
              <View style={[styles.quickActionIcon, { backgroundColor: Colors.accentBg }]}>
                <Truck size={20} color={Colors.accent} />
              </View>
              <Text style={styles.quickActionLabel}>Вывоз</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => handleQuickAction('/locations')}
              activeOpacity={0.7}
              testID="quick-locations"
            >
              <View style={[styles.quickActionIcon, { backgroundColor: Colors.successBg }]}>
                <MapPin size={20} color={Colors.success} />
              </View>
              <Text style={styles.quickActionLabel}>Точки</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={handleCallPress}
              activeOpacity={0.7}
              testID="quick-call"
            >
              <View style={[styles.quickActionIcon, { backgroundColor: Colors.dangerBg }]}>
                <Phone size={20} color={Colors.danger} />
              </View>
              <Text style={styles.quickActionLabel}>Звонок</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Цены на цветмет</Text>
              <TouchableOpacity
                onPress={() => handleQuickAction('/prices')}
                style={styles.seeAllButton}
                activeOpacity={0.7}
              >
                <Text style={styles.seeAllText}>Все цены</Text>
                <ChevronRight size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            {metalsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : (
              topMetals.map((metal) => {
                return (
                  <TouchableOpacity
                    key={metal.id}
                    style={styles.priceRow}
                    onPress={() => handleQuickAction('/prices')}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.metalDot, { backgroundColor: metal.color }]} />
                    <View style={styles.priceInfo}>
                      <Text style={styles.metalName}>{metal.name}</Text>
                      <Text style={styles.metalDesc}>{metal.unit}</Text>
                    </View>
                    <View style={styles.priceValues}>
                      <Text style={styles.priceAmount}>
                        {metal.priceCardFrom50 ?? metal.pricePerKg} ₽
                      </Text>
                      {metal.priceAccountLegal != null && metal.priceAccountLegal !== metal.priceCardFrom50 && (
                        <Text style={styles.priceSecondary}>
                          юрл. {metal.priceAccountLegal} ₽
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Почему мы</Text>
            <View style={styles.featuresGrid}>
              <View style={styles.featureCard}>
                <Shield size={22} color={Colors.primary} />
                <Text style={styles.featureTitle}>Честные цены</Text>
                <Text style={styles.featureDesc}>Актуальный прайс без скрытых условий</Text>
              </View>
              <View style={styles.featureCard}>
                <Truck size={22} color={Colors.accent} />
                <Text style={styles.featureTitle}>Самовывоз</Text>
                <Text style={styles.featureDesc}>Бесплатный вывоз от {minWeight} кг</Text>
              </View>
              <View style={styles.featureCard}>
                <Clock size={22} color={Colors.success} />
                <Text style={styles.featureTitle}>Быстро</Text>
                <Text style={styles.featureDesc}>Выезд в день обращения</Text>
              </View>
              <View style={styles.featureCard}>
                <Weight size={22} color={Colors.warning} />
                <Text style={styles.featureTitle}>Точный вес</Text>
                <Text style={styles.featureDesc}>Сертифицированные весы</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Text style={styles.infoEmoji}>⚡</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Важная информация</Text>
              <Text style={styles.infoText}>
                С 1 октября 2023 года расчёты с физ. лицами только безналичным способом (ФЗ №306)
              </Text>
            </View>
          </View>

          <View style={{ height: 24 }} />
        </Animated.View>
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
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  companyName: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroTextBlock: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    lineHeight: 20,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 18,
    gap: 6,
  },
  heroButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.bg,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 20,
    gap: 10,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  section: {
    marginTop: 28,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metalDot: {
    width: 8,
    height: 36,
    borderRadius: 4,
    marginRight: 12,
  },
  priceInfo: {
    flex: 1,
  },
  metalName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  metalDesc: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  priceValues: {
    alignItems: 'flex-end',
  },
  priceAmount: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  priceChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  priceChangeText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  priceSecondary: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  featureCard: {
    width: '48%' as any,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    flexBasis: '47%',
    flexGrow: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 10,
  },
  featureDesc: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 4,
    lineHeight: 16,
  },
  infoCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: Colors.primaryBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D92D2030',
    gap: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoEmoji: {
    fontSize: 20,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
