import { Stack } from 'expo-router';
import React from 'react';

import { useAppTheme } from '@/hooks/useAppTheme';

export default function PricesLayout() {
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
          title: 'Прайс-лист',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        }}
      />
    </Stack>
  );
}
