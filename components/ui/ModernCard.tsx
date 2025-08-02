import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from 'react-native-paper';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { DesignSystem } from '../../constants/DesignSystem';

interface ModernCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined' | 'ghost';
  padding?: keyof typeof DesignSystem.spacing;
  style?: ViewStyle;
  onPress?: () => void;
  animated?: boolean;
}

export const ModernCard: React.FC<ModernCardProps> = ({
  children,
  variant = 'default',
  padding = 6,
  style,
  onPress,
  animated = true,
}) => {
  const { colors, dark } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (animated && onPress) {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
    }
  };

  const handlePressOut = () => {
    if (animated && onPress) {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
  };

  const getCardStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: DesignSystem.borderRadius.xl,
      padding: DesignSystem.spacing[padding],
    };

    // Use theme colors for backgrounds and borders
    const variants = {
      default: {
        backgroundColor: dark ? colors.elevation.level2 : colors.surface,
        ...DesignSystem.shadows.base,
      },
      elevated: {
        backgroundColor: dark ? colors.elevation.level3 : colors.surface,
        ...DesignSystem.shadows.lg,
      },
      outlined: {
        backgroundColor: dark ? colors.elevation.level1 : colors.surface,
        borderWidth: 1,
        borderColor: dark ? colors.outline : DesignSystem.colors.neutral[200],
        shadowOpacity: 0,
        elevation: 0,
      },
      ghost: {
        backgroundColor: 'transparent',
        shadowOpacity: 0,
        elevation: 0,
      },
    };

    return {
      ...baseStyle,
      ...variants[variant],
    };
  };

  const CardComponent = animated ? Animated.View : View;

  if (onPress) {
    return (
      <Animated.View style={[getCardStyle(), animatedStyle, style]}>
        <Animated.View
          onTouchStart={handlePressIn}
          onTouchEnd={handlePressOut}
          style={{ flex: 1 }}
        >
          {children}
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <CardComponent style={[getCardStyle(), animated ? animatedStyle : {}, style]}>
      {children}
    </CardComponent>
  );
};