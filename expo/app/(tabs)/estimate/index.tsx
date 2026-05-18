import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import {
  Camera,
  ImageIcon,
  MapPin,
  ChevronDown,
  Check,
  Scale,
  Sparkles,
  Tag,
  AlertTriangle,
  RotateCcw,
  Info,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useMutation } from '@tanstack/react-query';

import { AppColors } from '@/constants/colors';
import { useAppTheme } from '@/hooks/useAppTheme';
import { cities } from '@/mocks/cities';
import { City } from '@/constants/types';
import { analyzeMetalImage, MetalAnalysisResult } from '@/services/openai';
import { useMetalsByCity } from '@/hooks/useMetals';
import { ApiMetal } from '@/services/metalsApi';

interface CityGroup {
  region: string;
  cities: City[];
}

interface EstimateResult {
  metal: ApiMetal;
  confidence: number;
  cityName: string;
  pricePerKg: number;
  weight: number;
  total: number;
  isFerrous: boolean;
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function EstimateScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [cityModalVisible, setCityModalVisible] = useState<boolean>(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [weight, setWeight] = useState<string>('');
  const [metalHint, setMetalHint] = useState<string>('');
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [permissionHint, setPermissionHint] = useState<string | null>(null);
  const resultAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const cityGroups = useMemo(() => groupCitiesByRegion(cities), []);
  const selectedCity = useMemo(
    () => cities.find((c) => c.id === selectedCityId),
    [selectedCityId],
  );

  const { metals: cityMetals } = useMetalsByCity(selectedCityId ?? '1');

  const isFormValid = useMemo(() => {
    return !!selectedCityId && !!imageBase64 && !!weight.trim() && Number(weight) > 0;
  }, [selectedCityId, imageBase64, weight]);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCityId) {
        throw new Error('Выберите город для расчёта');
      }

      if (!weight.trim() || isNaN(Number(weight)) || Number(weight) <= 0) {
        throw new Error('Введите корректный вес в килограммах');
      }

      if (!imageBase64) {
        throw new Error('Добавьте фото лома для анализа');
      }

      const weightNum = Number(weight);

      console.log('[Estimate] Starting analysis for city:', selectedCityId);
      const metalNames = cityMetals.map((m) => m.name);
      const analysis: MetalAnalysisResult = await analyzeMetalImage(imageBase64, metalNames, metalHint.trim() || undefined);
      console.log('[Estimate] AI result:', analysis.metalName, 'confidence:', analysis.confidence);

      const metal = cityMetals.find(
        (m) => m.name.toLowerCase() === analysis.metalName.toLowerCase(),
      );

      if (!metal) {
        console.log('[Estimate] Metal not found in database:', analysis.metalName);
        throw new Error(`Металл "${analysis.metalName}" не найден в базе. Попробуйте другое фото.`);
      }

      const isFerrous = metal.category === 'ferrous';
      let pricePerKg: number;
      if (weightNum >= 50) {
        pricePerKg = metal.priceCardFrom50 ?? metal.priceCardUpto50 ?? metal.pricePerKg;
      } else {
        pricePerKg = metal.priceCardUpto50 ?? metal.priceCardFrom50 ?? metal.pricePerKg;
      }
      console.log('[Estimate] Weight:', weightNum, 'kg, using price tier:', weightNum >= 50 ? 'from50' : 'upto50', 'price:', pricePerKg);
      const total = pricePerKg * weightNum;

      const cityObj = cities.find((c) => c.id === selectedCityId);

      return {
        metal,
        confidence: analysis.confidence,
        cityName: cityObj?.name ?? '',
        pricePerKg,
        weight: weightNum,
        total,
        isFerrous,
      } satisfies EstimateResult;
    },
    onSuccess: (data) => {
      console.log('[Estimate] Success:', data.metal.name, 'total:', data.total);
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setResult(data);
      resultAnim.setValue(0);
      Animated.spring(resultAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    },
    onError: (error: Error) => {
      console.log('[Estimate] Error:', error.message);
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert('Ошибка', error.message);
    },
  });

  const pickImage = useCallback(async (source: 'camera' | 'gallery') => {
    try {
      let pickerResult: ImagePicker.ImagePickerResult;

      if (source === 'camera') {
        const permission = await ImagePicker.getCameraPermissionsAsync();
        let granted = permission.granted;
        if (!granted && permission.canAskAgain) {
          const req = await ImagePicker.requestCameraPermissionsAsync();
          granted = req.granted;
        }
        if (!granted) {
          setPermissionHint('Для оценки металла можно предоставить доступ к камере в настройках устройства.');
          return;
        }
        setPermissionHint(null);
        pickerResult = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
        });
      } else {
        const permission = await ImagePicker.getMediaLibraryPermissionsAsync();
        let granted = permission.granted;
        if (!granted && permission.canAskAgain) {
          const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
          granted = req.granted;
        }
        if (!granted) {
          setPermissionHint('Для оценки металла можно предоставить доступ к фото в настройках устройства.');
          return;
        }
        setPermissionHint(null);
        pickerResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
        });
      }

      if (!pickerResult.canceled && pickerResult.assets[0]) {
        const asset = pickerResult.assets[0];
        console.log('[Estimate] Image selected, size:', asset.width, 'x', asset.height);
        setImageUri(asset.uri);
        setImageBase64(asset.base64 ?? null);
        setResult(null);

        if (Platform.OS !== 'web') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    } catch (error) {
      console.log('[Estimate] Image picker error:', error);
    }
  }, []);

  const handleCitySelect = useCallback((cityId: string) => {
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync();
    }
    setSelectedCityId(cityId);
    setCityModalVisible(false);
    setResult(null);
  }, []);

  const handleReset = useCallback(() => {
    setImageUri(null);
    setImageBase64(null);
    setWeight('');
    setMetalHint('');
    setResult(null);
    resultAnim.setValue(0);
  }, [resultAnim]);

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

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
                      testID={`estimate-city-${city.id}`}
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
                      {isSelected && <Check size={18} color={Colors.primary} />}
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

  const renderResult = () => {
    if (!result) return null;

    const confidencePercent = Math.round(result.confidence * 100);
    const confidenceColor =
      confidencePercent >= 80
        ? Colors.success
        : confidencePercent >= 60
          ? Colors.warning
          : Colors.danger;

    return (
      <Animated.View
        style={[
          styles.resultCard,
          {
            opacity: resultAnim,
            transform: [
              {
                translateY: resultAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.resultHeader}>
          <Sparkles size={20} color={Colors.warning} />
          <Text style={styles.resultTitle}>Результат анализа</Text>
        </View>

        <View style={styles.resultDivider} />

        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Определён</Text>
          <Text style={styles.resultValue}>{result.metal.name}</Text>
        </View>

        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Вероятность</Text>
          <View style={styles.confidenceBadge}>
            <View
              style={[
                styles.confidenceDot,
                { backgroundColor: confidenceColor },
              ]}
            />
            <Text style={[styles.confidenceText, { color: confidenceColor }]}>
              {confidencePercent}%
            </Text>
          </View>
        </View>

        <View style={styles.resultDivider} />

        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Город</Text>
          <Text style={styles.resultValue}>{result.cityName}</Text>
        </View>

        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Цена</Text>
          <Text style={styles.resultValue}>
            {formatCurrency(result.pricePerKg)} ₽/{result.isFerrous ? 'кг' : 'кг'}
          </Text>
        </View>

        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Вес</Text>
          <Text style={styles.resultValue}>{formatCurrency(result.weight)} кг</Text>
        </View>

        <View style={styles.resultDivider} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Примерная стоимость</Text>
          <Text style={styles.totalValue}>{formatCurrency(result.total)} ₽</Text>
        </View>

        <View style={styles.warningBanner}>
          <AlertTriangle size={14} color={Colors.warning} />
          <Text style={styles.warningText}>
            Это предварительная оценка. Итоговая цена определяется при приёме.
          </Text>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {renderCityModal()}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.subtitle}>
            Сфотографируйте лом — AI определит тип и рассчитает стоимость
          </Text>

          <TouchableOpacity
            style={styles.citySelectorBtn}
            onPress={() => setCityModalVisible(true)}
            activeOpacity={0.7}
            testID="estimate-city-selector"
          >
            <View style={styles.citySelectorLeft}>
              <View style={styles.cityIconWrap}>
                <MapPin size={16} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.citySelectorLabel}>Город</Text>
                <Text style={styles.citySelectorValue}>
                  {selectedCity ? selectedCity.name : 'Выберите город'}
                </Text>
              </View>
            </View>
            <ChevronDown size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          {!selectedCityId && (
            <View style={styles.hintRow}>
              <Info size={13} color={Colors.warning} />
              <Text style={[styles.hintText, { color: Colors.warning }]}>Выберите город для расчёта цены</Text>
            </View>
          )}

          <View style={styles.photoSection}>
            {imageUri ? (
              <View style={styles.imagePreviewWrap}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.imageRemoveBtn}
                  onPress={handleReset}
                  activeOpacity={0.7}
                >
                  <RotateCcw size={16} color={Colors.text} />
                </TouchableOpacity>
              </View>
            ) : (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <View style={styles.photoPlaceholder}>
                  <Camera size={36} color={Colors.textTertiary} />
                  <Text style={styles.photoPlaceholderText}>Добавьте фото лома</Text>
                </View>
              </Animated.View>
            )}

            <View style={styles.photoButtons}>
              <TouchableOpacity
                style={styles.photoBtn}
                onPress={() => pickImage('camera')}
                activeOpacity={0.7}
                testID="btn-camera"
              >
                <Camera size={18} color={Colors.primary} />
                <Text style={styles.photoBtnText}>Камера</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.photoBtn}
                onPress={() => pickImage('gallery')}
                activeOpacity={0.7}
                testID="btn-gallery"
              >
                <ImageIcon size={18} color={Colors.primary} />
                <Text style={styles.photoBtnText}>Галерея</Text>
              </TouchableOpacity>
            </View>

            {permissionHint && (
              <View style={styles.hintRow}>
                <Info size={13} color={Colors.textSecondary} />
                <Text style={[styles.hintText, { color: Colors.textSecondary }]}>{permissionHint}</Text>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <Tag size={14} color={Colors.primary} />
              <Text style={styles.inputLabel}>Тип металла</Text>
              <Text style={styles.inputLabelOptional}>необязательно</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Например: медь, алюминий, чугун"
              placeholderTextColor={Colors.textTertiary}
              value={metalHint}
              onChangeText={(val) => {
                setMetalHint(val);
                setResult(null);
              }}
              autoCapitalize="none"
              testID="input-metal-hint"
            />
            <View style={styles.hintRowInput}>
              <Info size={13} color={Colors.textTertiary} />
              <Text style={[styles.hintText, { color: Colors.textTertiary }]}>
                Подскажите AI, какой это металл — повысит точность
              </Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <Scale size={14} color={Colors.primary} />
              <Text style={styles.inputLabel}>Вес (кг)</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Введите вес в килограммах"
              placeholderTextColor={Colors.textTertiary}
              value={weight}
              onChangeText={(val) => {
                setWeight(val);
                setResult(null);
              }}
              keyboardType="numeric"
              testID="input-weight"
            />
            {!weight.trim() && (
              <View style={styles.hintRowInput}>
                <Info size={13} color={Colors.warning} />
                <Text style={[styles.hintText, { color: Colors.warning }]}>Укажите вес для расчёта</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.calculateBtn,
              (!isFormValid || analyzeMutation.isPending) && styles.calculateBtnDisabled,
            ]}
            onPress={() => analyzeMutation.mutate()}
            activeOpacity={0.8}
            disabled={!isFormValid || analyzeMutation.isPending}
            testID="btn-calculate"
          >
            {analyzeMutation.isPending ? (
              <>
                <ActivityIndicator size="small" color={Colors.bg} />
                <Text style={styles.calculateBtnText}>Анализируем...</Text>
              </>
            ) : (
              <>
                <Sparkles size={18} color={Colors.bg} />
                <Text style={styles.calculateBtnText}>Рассчитать</Text>
              </>
            )}
          </TouchableOpacity>

          {analyzeMutation.isPending && (
            <View style={styles.loadingHint}>
              <Text style={styles.loadingHintText}>
                AI анализирует фотографию. Это может занять несколько секунд...
              </Text>
            </View>
          )}

          {renderResult()}

          <View style={styles.disclaimerCard}>
            <AlertTriangle size={14} color={Colors.textTertiary} />
            <Text style={styles.disclaimerText}>
              Точность определения ~70–80%. Редкие сплавы могут определяться неверно. Результат
              является предварительной оценкой.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (Colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  citySelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
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
  cityIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
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
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 8,
  },
  hintText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  hintRowInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  photoSection: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 16,
  },
  photoPlaceholder: {
    height: 180,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    gap: 10,
  },
  photoPlaceholderText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
  },
  imagePreviewWrap: {
    position: 'relative' as const,
    borderRadius: 16,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 220,
    borderRadius: 16,
  },
  imageRemoveBtn: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  photoBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  inputGroup: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  inputLabelOptional: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textTertiary,
    marginLeft: 4,
  },
  input: {
    backgroundColor: Colors.bgInput,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  calculateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    gap: 8,
  },
  calculateBtnDisabled: {
    opacity: 0.5,
  },
  calculateBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.bg,
  },
  loadingHint: {
    marginHorizontal: 16,
    marginTop: 12,
    alignItems: 'center',
  },
  loadingHintText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  resultCard: {
    marginHorizontal: 16,
    marginTop: 24,
    padding: 18,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  resultTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  resultDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  resultLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  resultValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    flexShrink: 1,
    textAlign: 'right' as const,
    maxWidth: '60%',
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: Colors.bgCardElevated,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.success,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
    padding: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.15)',
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: Colors.warning,
    lineHeight: 17,
  },
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 20,
    padding: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textTertiary,
    lineHeight: 17,
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
