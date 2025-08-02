import React, { useRef, useState, useEffect } from 'react';
import {
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { DesignSystem } from '../../constants/DesignSystem';

interface ModernInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  disabled?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?:
    | 'default'
    | 'email-address'
    | 'numeric'
    | 'phone-pad'
    | 'decimal-pad'
    | 'number-pad';
  secureTextEntry?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  autoFocus?: boolean;
  maxLength?: number;
  editable?: boolean;
  pointerEvents?: 'none' | 'auto'; // Add pointerEvents prop
}

export const ModernInput: React.FC<ModernInputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  disabled = false,
  multiline = false,
  numberOfLines = 1,
  keyboardType = 'default',
  secureTextEntry = false,
  leftIcon,
  rightIcon,
  onRightIconPress,
  style,
  inputStyle,
  autoFocus = false,
  maxLength,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { colors, dark } = useTheme();

  const focusAnimation = useSharedValue(0);
  const labelAnimation = useSharedValue(value ? 1 : 0);
  const animationDuration = 120;

  // Update label animation when value changes
  useEffect(() => {
    if (value && value.trim()) {
      labelAnimation.value = withTiming(1, { duration: animationDuration });
    } else if (!isFocused) {
      labelAnimation.value = withTiming(0, { duration: animationDuration });
    }
  }, [value]);

  const animatedContainerStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      focusAnimation.value,
      [0, 1],
      [
        error
          ? DesignSystem.colors.error[500]
          : dark
          ? colors.outline
          : DesignSystem.colors.neutral[300],
        error ? DesignSystem.colors.error[500] : colors.primary,
      ]
    );

    return {
      borderColor,
      shadowOpacity: focusAnimation.value * (dark ? 0.3 : 0.1),
      shadowRadius: focusAnimation.value * 8,
      elevation: focusAnimation.value * 4,
    };
  });

  const animatedLabelStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: withTiming(labelAnimation.value ? -24 : 0, {
            duration: animationDuration,
          }),
        },
        {
          scale: withTiming(labelAnimation.value ? 0.85 : 1, {
            duration: animationDuration,
          }),
        },
      ],
      opacity: withTiming(labelAnimation.value ? 1 : 0.6, {
        duration: animationDuration,
      }),
    };
  });

  const handleFocus = () => {
    setIsFocused(true);
    focusAnimation.value = withTiming(1, { duration: animationDuration });
    if (label) {
      labelAnimation.value = withTiming(1, { duration: animationDuration });
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    focusAnimation.value = withTiming(0, { duration: animationDuration });
    if (label && !value.trim()) {
      labelAnimation.value = withTiming(0, { duration: animationDuration });
    }
  };

  const containerStyle: ViewStyle = {
    marginBottom: DesignSystem.spacing[5],
    ...style,
  };

  const inputContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center', // 👈 key to align icon + text
    borderWidth: 2,
    borderRadius: DesignSystem.borderRadius.lg,
    backgroundColor: disabled
      ? dark
        ? colors.surfaceDisabled
        : DesignSystem.colors.neutral[100]
      : dark
      ? colors.surface
      : '#ffffff',
    paddingHorizontal: DesignSystem.spacing[4],
    minHeight: 56,
    shadowColor: colors.primary,
  };

  const textInputStyle: TextStyle = {
    flex: 1,
    fontSize: DesignSystem.typography.fontSizes.base,
    color: dark ? colors.onSurface : DesignSystem.colors.neutral[900],
    paddingVertical: 0,
    paddingTop: 10,
    paddingBottom: 10,
    textAlignVertical: 'center',
    lineHeight: DesignSystem.typography.fontSizes.base + 4,
    letterSpacing: 0.25,
    fontWeight: '400',
    ...inputStyle,
  };

  const labelStyle: TextStyle = {
    position: 'absolute',
    left: leftIcon ? 0 : DesignSystem.spacing[4],
    top: 16,
    fontSize: DesignSystem.typography.fontSizes.sm,
    fontWeight: '500',
    color: error
      ? DesignSystem.colors.error[500]
      : isFocused
      ? colors.primary
      : dark
      ? colors.onSurfaceVariant
      : colors.onSurfaceVariant,
    backgroundColor: dark ? colors.surface : '#ffffff',
    paddingHorizontal: 6,
    zIndex: 10,
  };

  return (
    <View style={containerStyle}>
      <Animated.View style={[inputContainerStyle, animatedContainerStyle]}>
        {leftIcon && (
          <View
            style={{
              width: 24,
              height: 24,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: DesignSystem.spacing[3],
            }}
          >
            {leftIcon}
          </View>
        )}

        <View style={{ flex: 1, position: 'relative' }}>
          {label && (
            <Animated.Text style={[labelStyle, animatedLabelStyle]}>
              {label}
            </Animated.Text>
          )}

          <TextInput
            ref={inputRef}
            style={textInputStyle}
            placeholder={label && !isFocused ? undefined : placeholder}
            placeholderTextColor={
              dark
                ? colors.onSurfaceVariant
                : DesignSystem.colors.neutral[400]
            }
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            editable={!disabled}
            multiline={multiline}
            numberOfLines={numberOfLines}
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
            autoFocus={autoFocus}
            maxLength={maxLength}
          />
        </View>

        {rightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={{
              marginLeft: DesignSystem.spacing[3],
              padding: DesignSystem.spacing[1],
              borderRadius: DesignSystem.borderRadius.base,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            disabled={!onRightIconPress}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </Animated.View>

      {error && (
        <Animated.Text
          style={{
            color: DesignSystem.colors.error[500],
            fontSize: DesignSystem.typography.fontSizes.sm,
            marginTop: DesignSystem.spacing[1],
            marginLeft: DesignSystem.spacing[1],
            fontWeight: '500',
          }}
        >
          {error}
        </Animated.Text>
      )}
    </View>
  );
};
