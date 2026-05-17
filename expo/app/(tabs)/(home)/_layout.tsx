import { Stack } from 'expo-router';
import React from 'react';

import { useAppTheme } from '@/hooks/useAppTheme';

export default function HomeLayout() {
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
          headerShown: false,
        }}
      />
    </Stack>
  );
}
