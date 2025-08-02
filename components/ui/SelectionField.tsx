import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { useTheme } from 'react-native-paper';

interface SelectionFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  leftIcon?: React.ReactNode;
  onPress: () => void;
  error?: string;
  style?: any;
}

export const SelectionField: React.FC<SelectionFieldProps> = ({
  label,
  value,
  placeholder = 'Select option',
  leftIcon,
  onPress,
  error,
  style,
}) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity 
      onPress={onPress} 
      activeOpacity={0.7}
      style={[{ marginBottom: 12 }, style]}
    >
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderRadius: 12,
        backgroundColor: colors.surface,
        paddingHorizontal: 16,
        minHeight: 56,
        borderColor: error ? colors.error : colors.outline,
      }}>
        {leftIcon && (
          <View style={{ marginRight: 12 }}>
            {leftIcon}
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 2 }}>{label}</Text>
          <Text style={{ fontSize: 16, color: colors.onSurface }}>
            {value || placeholder}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-down" size={22} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );
}; 