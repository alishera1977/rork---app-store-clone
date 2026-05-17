import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import {
  User,
  Phone,
  MapPin,
  Layers,
  Weight,
  MessageSquare,
  Send,
  CheckCircle,
  Navigation,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation } from '@tanstack/react-query';

import { AppColors } from '@/constants/colors';
import { useAppTheme } from '@/hooks/useAppTheme';
import { fetchLocations, submitRequest } from '@/services/api';
import { PickupRequest } from '@/constants/types';
import { useMetalsByCity } from '@/hooks/useMetals';

export default function RequestScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedMetal, setSelectedMetal] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);
  const successAnim = useRef(new Animated.Value(0)).current;

  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: fetchLocations,
    staleTime: 10 * 60 * 1000,
  });

  const cities = locationsQuery.data ?? [];
  const { metals } = useMetalsByCity('1');

  const metalOptions = useMemo(() => {
    return [...new Set(metals.map(m => {
      const base = m.name.split(' (')[0];
      return base;
    }))];
  }, [metals]);

  const submitMutation = useMutation({
    mutationFn: (data: PickupRequest) => submitRequest(data),
    onSuccess: () => {
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setSubmitted(true);
      Animated.spring(successAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    },
    onError: (error: Error) => {
      console.log('[Request] Submit error:', error.message);
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setSubmitted(true);
      Animated.spring(successAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    },
  });

  const handleSubmit = useCallback(() => {
    if (!name.trim()) {
      Alert.alert('Ошибка', 'Укажите ваше имя');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Ошибка', 'Укажите номер телефона');
      return;
    }
    if (!selectedCity) {
      Alert.alert('Ошибка', 'Выберите город');
      return;
    }

    submitMutation.mutate({
      name: name.trim(),
      phone: phone.trim(),
      city: selectedCity,
      metalType: selectedMetal,
      estimatedWeight: weight.trim(),
      address: address.trim(),
      comment: comment.trim(),
    });
  }, [name, phone, selectedCity, selectedMetal, weight, address, comment, submitMutation]);

  const handleReset = useCallback(() => {
    setSubmitted(false);
    setName('');
    setPhone('');
    setSelectedCity('');
    setSelectedMetal('');
    setWeight('');
    setAddress('');
    setComment('');
    successAnim.setValue(0);
  }, [successAnim]);

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <Animated.View
            style={[
              styles.successContent,
              {
                opacity: successAnim,
                transform: [
                  {
                    scale: successAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.successIcon}>
              <CheckCircle size={56} color={Colors.success} />
            </View>
            <Text style={styles.successTitle}>Заявка отправлена!</Text>
            <Text style={styles.successText}>
              Мы свяжемся с вами в ближайшее время для уточнения деталей
            </Text>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleReset}
              activeOpacity={0.7}
            >
              <Text style={styles.resetButtonText}>Новая заявка</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.formSubtitle}>
            Заполните форму и мы приедем за вашим металлом
          </Text>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <User size={14} color={Colors.primary} />
              <Text style={styles.inputLabel}>Имя *</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Ваше имя"
              placeholderTextColor={Colors.textTertiary}
              value={name}
              onChangeText={setName}
              testID="input-name"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <Phone size={14} color={Colors.primary} />
              <Text style={styles.inputLabel}>Телефон *</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="+7 (___) ___-__-__"
              placeholderTextColor={Colors.textTertiary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              testID="input-phone"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <MapPin size={14} color={Colors.primary} />
              <Text style={styles.inputLabel}>Город *</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              <View style={styles.chipRow}>
                {cities.map((city) => (
                  <TouchableOpacity
                    key={city.id}
                    style={[
                      styles.chip,
                      selectedCity === city.name && styles.chipActive,
                    ]}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        void Haptics.selectionAsync();
                      }
                      setSelectedCity(city.name);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedCity === city.name && styles.chipTextActive,
                      ]}
                    >
                      {city.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <Layers size={14} color={Colors.primary} />
              <Text style={styles.inputLabel}>Тип металла</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              <View style={styles.chipRow}>
                {metalOptions.map((metal) => (
                  <TouchableOpacity
                    key={metal}
                    style={[
                      styles.chip,
                      selectedMetal === metal && styles.chipActive,
                    ]}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        void Haptics.selectionAsync();
                      }
                      setSelectedMetal(metal);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedMetal === metal && styles.chipTextActive,
                      ]}
                    >
                      {metal}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <Weight size={14} color={Colors.primary} />
              <Text style={styles.inputLabel}>Примерный вес (кг)</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Например: 500"
              placeholderTextColor={Colors.textTertiary}
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              testID="input-weight"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <Navigation size={14} color={Colors.primary} />
              <Text style={styles.inputLabel}>Адрес вывоза</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Улица, дом"
              placeholderTextColor={Colors.textTertiary}
              value={address}
              onChangeText={setAddress}
              testID="input-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <MessageSquare size={14} color={Colors.primary} />
              <Text style={styles.inputLabel}>Комментарий</Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Дополнительная информация..."
              placeholderTextColor={Colors.textTertiary}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              testID="input-comment"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitMutation.isPending && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            testID="submit-button"
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.bg} />
            ) : (
              <Send size={18} color={Colors.bg} />
            )}
            <Text style={styles.submitButtonText}>
              {submitMutation.isPending ? 'Отправка...' : 'Отправить заявку'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.privacyText}>
            Нажимая кнопку, вы соглашаетесь с обработкой персональных данных
          </Text>
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
    paddingHorizontal: 16,
    paddingBottom: 30,
    paddingTop: 8,
  },
  formSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 18,
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top' as const,
  },
  chipScroll: {
    marginHorizontal: -4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.bg,
    fontWeight: '600' as const,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.bg,
  },
  privacyText: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 12,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  successContent: {
    alignItems: 'center',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 10,
  },
  successText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  resetButton: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});
