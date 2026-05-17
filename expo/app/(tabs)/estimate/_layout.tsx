import { Stack } from 'expo-router';
import React from 'react';
import { useAppTheme } from '@/hooks/useAppTheme';

export default function EstimateLayout() {
  const { colors: Colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.text,
        headerTitle: 'Оценить лом',
        headerTitleStyle: { fontWeight: '700' },
      }}
    />
  );
}
