import { Stack } from 'expo-router';
import React from 'react';

import { useAppTheme } from '@/hooks/useAppTheme';

export default function MoreLayout() {
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
          title: 'Ещё',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        }}
      />
    </Stack>
  );
}
