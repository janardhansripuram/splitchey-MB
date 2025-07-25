import React from 'react';
import { Button, useTheme } from 'react-native-paper';
import { StyleProp, ViewStyle } from 'react-native';

interface GroupButtonProps {
  mode?: 'contained' | 'outlined' | 'text';
  icon?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function GroupButton({ mode = 'contained', icon, children, style, onPress, disabled, loading }: GroupButtonProps) {
  const { colors } = useTheme();
  return (
    <Button
      mode={mode}
      icon={icon}
      style={[
        mode === 'contained' && { backgroundColor: colors.primary },
        { borderRadius: 10, minHeight: 40, paddingHorizontal: 12, alignSelf: 'auto' },
        style,
      ]}
      labelStyle={{ fontWeight: 'bold', fontSize: 15, color: mode === 'contained' ? colors.onPrimary : colors.primary, textTransform: 'none', letterSpacing: 0.2 }}
      contentStyle={{ height: 40 }}
      onPress={onPress}
      disabled={disabled}
      loading={loading}
    >
      {children}
    </Button>
  );
} 