import React from 'react';
import { ActivityIndicator, Text, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { DesignSystem } from '../../constants/DesignSystem';

interface ModernButtonProps {
  title: string;
  label?: string; // Optional label prop
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const ModernButton: React.FC<ModernButtonProps> = ({
  title,
  label, // Optional label prop
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  fullWidth = false,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
    opacity.value = withTiming(0.8, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    opacity.value = withTiming(1, { duration: 100 });
  };

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: DesignSystem.borderRadius.md,
      ...DesignSystem.shadows.base,
    };

    // Size variants
    const sizeStyles = {
      sm: {
        paddingVertical: DesignSystem.spacing[2],
        paddingHorizontal: DesignSystem.spacing[4],
        minHeight: 36,
      },
      md: {
        paddingVertical: DesignSystem.spacing[3],
        paddingHorizontal: DesignSystem.spacing[6],
        minHeight: 44,
      },
      lg: {
        paddingVertical: DesignSystem.spacing[4],
        paddingHorizontal: DesignSystem.spacing[8],
        minHeight: 52,
      },
    };

    // Color variants
    const colorStyles = {
      primary: {
        backgroundColor: DesignSystem.colors.primary[500],
      },
      secondary: {
        backgroundColor: DesignSystem.colors.secondary[500],
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: DesignSystem.colors.primary[500],
        shadowOpacity: 0,
        elevation: 0,
      },
      ghost: {
        backgroundColor: 'transparent',
        shadowOpacity: 0,
        elevation: 0,
      },
      danger: {
        backgroundColor: DesignSystem.colors.error[500],
      },
    };

    if (fullWidth) {
      baseStyle.width = '100%';
    }

    if (disabled) {
      baseStyle.opacity = 0.5;
    }

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...colorStyles[variant],
    };
  };

  const getTextStyle = (): TextStyle => {
    const baseTextStyle: TextStyle = {
      fontWeight: 'semibold',
      textAlign: 'center',
    };

    const sizeTextStyles = {
      sm: { fontSize: DesignSystem.typography.fontSizes.sm },
      md: { fontSize: DesignSystem.typography.fontSizes.base },
      lg: { fontSize: DesignSystem.typography.fontSizes.lg },
    };

    const colorTextStyles = {
      primary: { color: '#ffffff' },
      secondary: { color: '#ffffff' },
      outline: { color: DesignSystem.colors.primary[500] },
      ghost: { color: DesignSystem.colors.primary[500] },
      danger: { color: '#ffffff' },
    };

    return {
      ...baseTextStyle,
      ...sizeTextStyles[size],
      ...colorTextStyles[variant],
      ...textStyle,
    };
  };

  return (
    <AnimatedTouchableOpacity
      style={[getButtonStyle(), animatedStyle, style]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={1}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={variant === 'outline' || variant === 'ghost' ? DesignSystem.colors.primary[500] : '#ffffff'} 
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Animated.View style={{ marginRight: DesignSystem.spacing[2] }}>
              {icon}
            </Animated.View>
          )}
          <Text style={getTextStyle()}>{title || label}</Text>
          {icon && iconPosition === 'right' && (
            <Animated.View style={{ marginLeft: DesignSystem.spacing[2] }}>
              {icon}
            </Animated.View>
          )}
        </>
      )}
    </AnimatedTouchableOpacity>
  );
};