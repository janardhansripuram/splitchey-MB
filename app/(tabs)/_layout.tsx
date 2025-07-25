import { Tabs } from 'expo-router';
import React from 'react';
import { LayoutDashboard, ReceiptText, Users, UserPlus2, UserCircle } from 'lucide-react-native';
import { useThemeMode } from '../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { paperTheme } = useThemeMode();
  const tabBarBg = paperTheme.colors.elevation?.level2 || paperTheme.colors.background;
  const tabBarActive = paperTheme.colors.primary;
  const tabBarInactive = paperTheme.colors.onSurfaceVariant || '#888';
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tabBarActive,
        tabBarInactiveTintColor: tabBarInactive,
        tabBarLabelStyle: { fontWeight: 'bold', fontSize: 13 },
        tabBarStyle: {
          height: 62 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 4,
          backgroundColor: tabBarBg,
          borderTopWidth: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          tabBarIcon: ({ color, size }) => (
            <ReceiptText color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, size }) => (
            <Users color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, size }) => (
            <UserPlus2 color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <UserCircle color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
