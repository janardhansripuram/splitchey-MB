import React, { useRef, useState } from 'react';
import { TextInput, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'decimal-pad';
  secureTextEntry?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  autoFocus?: boolean;
  maxLength?: number;
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
  
  const focusAnimation = useSharedValue(0);
  const labelAnimation = useSharedValue(value ? 1 : 0);

  const animatedContainerStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      focusAnimation.value,
      [0, 1],
      [
        error ? DesignSystem.colors.error[500] : DesignSystem.colors.neutral[300],
        error ? DesignSystem.colors.error[500] : DesignSystem.colors.primary[500]
      ]
    );

    return {
      borderColor,
      shadowOpacity: focusAnimation.value * 0.1,
      shadowRadius: focusAnimation.value * 4,
      elevation: focusAnimation.value * 2,
    };
  });

  const animatedLabelStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: withTiming(labelAnimation.value * -12, { duration: 200 }),
        },
        {
          scale: withTiming(1 - labelAnimation.value * 0.15, { duration: 200 }),
        },
      ],
    };
  });

  const handleFocus = () => {
    setIsFocused(true);
    focusAnimation.value = withTiming(1, { duration: 200 });
    if (label) {
      labelAnimation.value = withTiming(1, { duration: 200 });
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    focusAnimation.value = withTiming(0, { duration: 200 });
    if (label && !value) {
      labelAnimation.value = withTiming(0, { duration: 200 });
    }
  };

  const containerStyle: ViewStyle = {
    marginBottom: DesignSystem.spacing[4],
    ...style,
  };

  const inputContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: multiline ? 'flex-start' : 'center',
    borderWidth: 1.5,
    borderRadius: DesignSystem.borderRadius.md,
    backgroundColor: disabled ? DesignSystem.colors.neutral[100] : '#ffffff',
    paddingHorizontal: DesignSystem.spacing[4],
    paddingVertical: multiline ? DesignSystem.spacing[3] : DesignSystem.spacing[3],
    minHeight: multiline ? 80 : 52,
    shadowColor: DesignSystem.colors.primary[500],
  };

  const textInputStyle: TextStyle = {
    flex: 1,
    fontSize: DesignSystem.typography.fontSizes.base,
    color: DesignSystem.colors.neutral[900],
    paddingVertical: 0,
    textAlignVertical: multiline ? 'top' : 'center',
    ...inputStyle,
  };

  const labelStyle: TextStyle = {
    position: 'absolute',
    left: leftIcon ? 48 : DesignSystem.spacing[4],
    top: multiline ? DesignSystem.spacing[3] + 2 : 16,
    fontSize: DesignSystem.typography.fontSizes.base,
    color: error 
      ? DesignSystem.colors.error[500] 
      : isFocused 
        ? DesignSystem.colors.primary[500] 
        : DesignSystem.colors.neutral[500],
    backgroundColor: '#ffffff',
    paddingHorizontal: 4,
    zIndex: 1,
  };

  return (
    <View style={containerStyle}>
      <Animated.View style={[inputContainerStyle, animatedContainerStyle]}>
        {leftIcon && (
          <View style={{ marginRight: DesignSystem.spacing[3] }}>
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
            placeholder={!label ? placeholder : undefined}
            placeholderTextColor={DesignSystem.colors.neutral[400]}
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
            style={{ marginLeft: DesignSystem.spacing[3] }}
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
          }}
        >
          {error}
        </Animated.Text>
      )}
    </View>
  );
};