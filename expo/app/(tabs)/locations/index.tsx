import React, { useCallback, useMemo } from 'react';
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
} from 'react-native';
import {
  MapPin,
  Phone,
  Clock,
  Navigation,
  ExternalLink,
  Mail,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';

import { AppColors } from '@/constants/colors';
import { useAppTheme } from '@/hooks/useAppTheme';
import { fetchLocations } from '@/services/api';
import { ReceptionPoint } from '@/constants/types';

export default function LocationsScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: fetchLocations,
    staleTime: 10 * 60 * 1000,
  });

  const cities = locationsQuery.data ?? [];

  const totalPoints = cities.reduce((sum, c) => sum + c.receptionPoints.length, 0);

  const handleCall = useCallback((phone: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const firstPhone = phone.split(',')[0].trim();
    Linking.openURL(`tel:${firstPhone.replace(/[^+\d]/g, '')}`);
  }, []);

  const handleOpenMap = useCallback((point: ReceptionPoint, cityName: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const url = Platform.select({
      ios: `maps:0,0?q=${point.address},${cityName}`,
      android: `geo:${point.latitude},${point.longitude}?q=${point.address},${cityName}`,
      web: `https://maps.google.com/?q=${point.latitude},${point.longitude}`,
    });
    if (url) {
      Linking.openURL(url);
    }
  }, []);

  const handleEmail = useCallback((email: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Linking.openURL(`mailto:${email}`);
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={locationsQuery.isRefetching}
            onRefresh={() => locationsQuery.refetch()}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {locationsQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Загрузка точек...</Text>
          </View>
        ) : (
          <>
            <Text style={styles.subtitle}>
              {cities.length} {cities.length === 1 ? 'город' : cities.length < 5 ? 'города' : 'городов'}, {totalPoints} {totalPoints === 1 ? 'пункт' : totalPoints < 5 ? 'пункта' : 'пунктов'} приёма
            </Text>

            {cities.map((city) => (
              <View
                key={city.id}
                style={styles.cityCard}
              >
                <Text style={styles.cityName}>{city.name}</Text>
                <Text style={styles.regionText}>{city.region}</Text>

                <TouchableOpacity
                  style={styles.emailRow}
                  onPress={() => handleEmail(city.email)}
                  activeOpacity={0.7}
                >
                  <Mail size={13} color={Colors.textTertiary} />
                  <Text style={styles.emailText}>{city.email}</Text>
                </TouchableOpacity>

                {city.receptionPoints.map((point, idx) => (
                  <View
                    key={point.id}
                    style={[
                      styles.pointBlock,
                      idx < city.receptionPoints.length - 1 && styles.pointBlockBorder,
                    ]}
                  >
                    <View style={styles.infoRow}>
                      <MapPin size={14} color={Colors.textTertiary} />
                      <Text style={styles.infoText}>{point.address}</Text>
                    </View>

                    <View style={styles.infoRow}>
                      <Clock size={14} color={Colors.textTertiary} />
                      <Text style={styles.infoText}>{point.workingHours}</Text>
                    </View>

                    <View style={styles.infoRow}>
                      <Phone size={14} color={Colors.textTertiary} />
                      <Text style={styles.infoText}>{point.phone}</Text>
                    </View>

                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleCall(point.phone)}
                        activeOpacity={0.7}
                        testID={`call-${point.id}`}
                      >
                        <Phone size={16} color={Colors.primary} />
                        <Text style={styles.actionButtonText}>Позвонить</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, styles.actionButtonSecondary]}
                        onPress={() => handleOpenMap(point, city.name)}
                        activeOpacity={0.7}
                        testID={`map-${point.id}`}
                      >
                        <Navigation size={16} color={Colors.accent} />
                        <Text style={[styles.actionButtonText, { color: Colors.accent }]}>
                          Маршрут
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}

            <View style={styles.mapHint}>
              <ExternalLink size={16} color={Colors.textTertiary} />
              <Text style={styles.mapHintText}>
                Нажмите «Маршрут» чтобы открыть навигатор
              </Text>
            </View>
          </>
        )}
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
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  cityCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  cityName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  regionText: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginBottom: 8,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  emailText: {
    fontSize: 13,
    color: Colors.accent,
  },
  pointBlock: {
    paddingTop: 10,
    paddingBottom: 4,
  },
  pointBlockBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 6,
    paddingBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primaryBg,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E8A83825',
  },
  actionButtonSecondary: {
    backgroundColor: Colors.accentBg,
    borderColor: '#3B82F625',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  mapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  mapHintText: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
