import { Stack } from 'expo-router';
import React from 'react';

import { useAppTheme } from '@/hooks/useAppTheme';

export default function LocationsLayout() {
  const { colors: Colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Точки приёма',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        }}
      />
    </Stack>
  );
}
