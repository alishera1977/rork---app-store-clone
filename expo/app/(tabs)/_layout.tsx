import { Tabs } from 'expo-router';
import { Home, ListOrdered, Truck, MapPin, Menu, ScanSearch } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';

import { useAppTheme } from '@/hooks/useAppTheme';

export default function TabLayout() {
  const { colors: Colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.bgCard,
          borderTopColor: Colors.border,
          borderTopWidth: 0.5,
          ...(Platform.OS === 'web' ? { height: 60 } : {}),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600' as const,
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Главная',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="prices"
        options={{
          title: 'Прайс',
          tabBarIcon: ({ color, size }) => <ListOrdered size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="estimate"
        options={{
          title: 'Оценка',
          tabBarIcon: ({ color, size }) => <ScanSearch size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="request"
        options={{
          title: 'Заявка',
          tabBarIcon: ({ color, size }) => <Truck size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="locations"
        options={{
          title: 'Точки',
          tabBarIcon: ({ color, size }) => <MapPin size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Ещё',
          tabBarIcon: ({ color, size }) => <Menu size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
