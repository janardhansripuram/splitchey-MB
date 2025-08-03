import * as Haptics from 'expo-haptics';
import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';

interface HapticButtonProps extends TouchableOpacityProps {
  hapticType?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
}

export const HapticButton: React.FC<HapticButtonProps> = ({
  hapticType = 'light',
  children,
  onPress,
  style,
  ...props
}) => {
  const { colors } = useTheme();

  const triggerHaptic = () => {
    switch (hapticType) {
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  };

  const handlePress = (event: any) => {
    triggerHaptic();
    onPress?.(event);
  };

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={handlePress}
      activeOpacity={0.7}
      {...props}
    >
      {children}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    // Default styles can be overridden
  },
}); 