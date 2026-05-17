import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Modal,
  FlatList,
} from 'react-native';
import {
  Info,
  ChevronDown,
  MapPin,
  Check,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AppColors } from '@/constants/colors';
import { useAppTheme } from '@/hooks/useAppTheme';
import { City } from '@/constants/types';
import { cities } from '@/mocks/cities';
import { metalCategories } from '@/mocks/metals';
import { useMetalsByCity } from '@/hooks/useMetals';
import { ApiMetal } from '@/services/metalsApi';

type CategoryFilter = 'all' | 'non-ferrous' | 'ferrous';

interface CityGroup {
  region: string;
  cities: City[];
}

function groupCitiesByRegion(allCities: City[]): CityGroup[] {
  const map = new Map<string, City[]>();
  for (const city of allCities) {
    const list = map.get(city.region) ?? [];
    list.push(city);
    map.set(city.region, list);
  }
  return Array.from(map.entries()).map(([region, regionCities]) => ({
    region,
    cities: regionCities,
  }));
}

export default function PricesScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('all');
  const [selectedCityId, setSelectedCityId] = useState<string>('1');
  const [cityModalVisible, setCityModalVisible] = useState<boolean>(false);
  const fadeAnim = useRef(new Animated.Value(Platform.OS === 'web' ? 1 : 0)).current;

  const cityGroups = useMemo(() => groupCitiesByRegion(cities), []);

  const selectedCity = useMemo(
    () => cities.find((c) => c.id === selectedCityId),
    [selectedCityId],
  );

  const { metals, isLoading, isRefetching, isTemporarilyClosed, refetch } = useMetalsByCity(selectedCityId);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [fadeAnim]);

  const ferrousMetals = useMemo(() => {
    if (activeFilter === 'non-ferrous') return [];
    return metals.filter((m) => m.category === 'ferrous');
  }, [metals, activeFilter]);

  const nonFerrousMetals = useMemo(() => {
    if (activeFilter === 'ferrous') return [];
    return metals.filter((m) => {
      if (m.category !== 'non-ferrous') return false;
      const hasAnyPrice = m.priceCardUpto50 != null || m.priceCardFrom50 != null || m.priceAccountLegal != null;
      return hasAnyPrice;
    });
  }, [metals, activeFilter]);

  const handleFilterChange = useCallback((key: CategoryFilter) => {
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync();
    }
    setActiveFilter(key);
  }, []);

  const handleCitySelect = useCallback((cityId: string) => {
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync();
    }
    setSelectedCityId(cityId);
    setCityModalVisible(false);
  }, []);

  const formatPrice = (val: number | null): string => {
    if (val === null || val === undefined) return '—';
    return val.toLocaleString('ru-RU');
  };

  const formatFerrous = (val: number | null): string => {
    if (val === null || val === undefined) return '—';
    return val.toLocaleString('ru-RU');
  };

  const renderCityModal = () => (
    <Modal
      visible={cityModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setCityModalVisible(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setCityModalVisible(false)}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Выберите город</Text>

          <FlatList
            data={cityGroups}
            keyExtractor={(item) => item.region}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: group }) => (
              <View style={styles.regionGroup}>
                <Text style={styles.regionLabel}>{group.region}</Text>
                {group.cities.map((city) => {
                  const isSelected = city.id === selectedCityId;
                  return (
                    <TouchableOpacity
                      key={city.id}
                      style={[
                        styles.cityOption,
                        isSelected && styles.cityOptionActive,
                      ]}
                      onPress={() => handleCitySelect(city.id)}
                      activeOpacity={0.7}
                      testID={`city-option-${city.id}`}
                    >
                      <View style={styles.cityOptionLeft}>
                        <MapPin
                          size={16}
                          color={isSelected ? Colors.primary : Colors.textTertiary}
                        />
                        <Text
                          style={[
                            styles.cityOptionText,
                            isSelected && styles.cityOptionTextActive,
                          ]}
                        >
                          {city.name}
                        </Text>
                      </View>
                      {isSelected && (
                        <Check size={18} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderNonFerrousRow = (metal: ApiMetal, index: number, total: number) => (
    <View
      key={metal.id}
      style={[
        styles.tableRow,
        index % 2 === 0 && styles.tableRowEven,
        index === total - 1 && styles.tableRowLast,
      ]}
    >
      <View style={styles.nameCell}>
        <View
          style={[
            styles.metalIndicator,
            { backgroundColor: metal.color },
          ]}
        />
        <Text style={styles.metalName} numberOfLines={2}>
          {metal.name}
        </Text>
      </View>
      <Text style={styles.priceCell}>
        {formatPrice(metal.priceCardUpto50)}
      </Text>
      <Text style={[styles.priceCell, styles.priceCellHighlight]}>
        {formatPrice(metal.priceCardFrom50)}
      </Text>
      <Text style={[styles.priceCell, styles.priceCellHighlight]}>
        {formatPrice(metal.priceAccountLegal)}
      </Text>
    </View>
  );

  const renderFerrousRow = (metal: ApiMetal, index: number, total: number) => (
    <View
      key={metal.id}
      style={[
        styles.tableRow,
        index % 2 === 0 && styles.tableRowEven,
        index === total - 1 && styles.tableRowLast,
      ]}
    >
      <View style={styles.nameCell}>
        <View
          style={[
            styles.metalIndicator,
            { backgroundColor: metal.color },
          ]}
        />
        <Text style={styles.metalName} numberOfLines={2}>
          {metal.name}
        </Text>
      </View>
      <Text style={[styles.priceCellFerrous, styles.priceCellHighlight]}>
        {formatFerrous(metal.priceCardFrom50)}
      </Text>
      <Text style={[styles.priceCellFerrous, styles.priceCellHighlight]}>
        {formatFerrous(metal.priceAccountLegal)}
      </Text>
    </View>
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {renderCityModal()}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <TouchableOpacity
          style={styles.citySelectorBtn}
          onPress={() => setCityModalVisible(true)}
          activeOpacity={0.7}
          testID="city-selector"
        >
          <View style={styles.citySelectorLeft}>
            <MapPin size={18} color={Colors.primary} />
            <View>
              <Text style={styles.citySelectorLabel}>Город</Text>
              <Text style={styles.citySelectorValue}>
                {selectedCity?.name ?? 'Выберите город'}
              </Text>
            </View>
          </View>
          <ChevronDown size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.filterRow}>
          {metalCategories.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.filterChip,
                activeFilter === cat.key && styles.filterChipActive,
              ]}
              onPress={() => handleFilterChange(cat.key)}
              activeOpacity={0.7}
              testID={`filter-${cat.key}`}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === cat.key && styles.filterChipTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isTemporarilyClosed && (
          <View style={styles.closedBanner}>
            <Info size={16} color="#FF6B6B" />
            <Text style={styles.closedBannerText}>
              Данный филиал временно не работает
            </Text>
          </View>
        )}

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Загрузка цен...</Text>
          </View>
        ) : ferrousMetals.length === 0 && nonFerrousMetals.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>
              Нет данных о ценах для выбранного города
            </Text>
          </View>
        ) : (
          <>
            {(activeFilter === 'all' || activeFilter === 'ferrous') && ferrousMetals.length > 0 && (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Лом чёрных металлов</Text>
                <Text style={styles.sectionSubtitle}>Цена за 1000 кг в рублях</Text>

                <View style={styles.tableHeader}>
                  <Text style={[styles.thCell, styles.thName]}>Наименование</Text>
                  <Text style={[styles.thCell, styles.thPriceFerrous]}>На карту физ.л.</Text>
                  <Text style={[styles.thCell, styles.thPriceFerrous]}>На счёт юр.лиц</Text>
                </View>

                {ferrousMetals.map((metal, index) =>
                  renderFerrousRow(metal, index, ferrousMetals.length)
                )}
              </View>
            )}

            {(activeFilter === 'all' || activeFilter === 'non-ferrous') && nonFerrousMetals.length > 0 && (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Лом цветных металлов</Text>
                <Text style={styles.sectionSubtitle}>Цена за 1 кг в рублях</Text>

                <View style={styles.tableHeader}>
                  <Text style={[styles.thCell, styles.thName]}>Наименование</Text>
                  <Text style={[styles.thCell, styles.thPrice]}>до 50кг</Text>
                  <Text style={[styles.thCell, styles.thPrice]}>от 50кг</Text>
                  <Text style={[styles.thCell, styles.thPrice]}>юрл.</Text>
                </View>

                {nonFerrousMetals.map((metal, index) =>
                  renderNonFerrousRow(metal, index, nonFerrousMetals.length)
                )}
              </View>
            )}
          </>
        )}

        <View style={styles.disclaimer}>
          <Info size={16} color={Colors.textTertiary} />
          <Text style={styles.disclaimerText}>
            Цены на цветные металлы указаны за 1 кг, на чёрные — за 1000 кг.
            Актуальные цены уточняйте по телефону. Цены могут отличаться в
            зависимости от объёма и качества металла.
          </Text>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const createStyles = (Colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  citySelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  citySelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  citySelectorLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  citySelectorValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 1,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.bg,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    backgroundColor: Colors.bgCardElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 4,
  },
  thCell: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  thName: {
    flex: 1,
  },
  thPrice: {
    width: 62,
    textAlign: 'right' as const,
  },
  thPriceFerrous: {
    width: 90,
    textAlign: 'right' as const,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tableRowEven: {
    backgroundColor: Colors.bgCard,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  nameCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  metalIndicator: {
    width: 3,
    height: 28,
    borderRadius: 2,
    marginRight: 10,
  },
  metalName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  priceCell: {
    width: 62,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textAlign: 'right' as const,
  },
  priceCellHighlight: {
    color: Colors.text,
    fontWeight: '700' as const,
  },
  priceCellFerrous: {
    width: 90,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textAlign: 'right' as const,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.primary,
    textAlign: 'center' as const,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  disclaimer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    gap: 10,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    gap: 10,
  },
  closedBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FF6B6B',
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textTertiary,
    lineHeight: 17,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  regionGroup: {
    marginBottom: 8,
  },
  regionLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: Colors.bg,
  },
  cityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cityOptionActive: {
    backgroundColor: Colors.primaryBg,
  },
  cityOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cityOptionText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  cityOptionTextActive: {
    color: Colors.primary,
    fontWeight: '700' as const,
  },
});
