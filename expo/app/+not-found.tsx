import { Link, Stack } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppColors } from '@/constants/colors';
import { useAppTheme } from '@/hooks/useAppTheme';

export default function NotFoundScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  return (
    <>
      <Stack.Screen options={{ title: 'Не найдено' }} />
      <View style={styles.container}>
        <Text style={styles.emoji}>🔩</Text>
        <Text style={styles.title}>Страница не найдена</Text>
        <Text style={styles.subtitle}>Такой страницы не существует</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>На главную</Text>
        </Link>
      </View>
    </>
  );
}

const createStyles = (Colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Colors.bg,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  link: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.primaryBg,
    borderRadius: 12,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});
