import { Check, ChevronDown } from 'lucide-react-native';
import React, { useState } from 'react';
import { FlatList, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { DesignSystem } from '../../constants/DesignSystem';

interface DropdownOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

interface ModernDropdownProps {
  label?: string;
  placeholder?: string;
  options: DropdownOption[];
  value: string;
  onSelect: (value: string) => void;
  error?: string;
  disabled?: boolean;
  style?: ViewStyle;
  searchable?: boolean;
  maxHeight?: number;
}

export const ModernDropdown: React.FC<ModernDropdownProps> = ({
  label,
  placeholder = 'Select an option',
  options,
  value,
  onSelect,
  error,
  disabled = false,
  style,
  searchable = false,
  maxHeight = 200,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  
  const rotation = useSharedValue(0);
  const dropdownHeight = useSharedValue(0);
  const opacity = useSharedValue(0);

  const selectedOption = options.find(option => option.value === value);
  const filteredOptions = searchable 
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchText.toLowerCase())
      )
    : options;

  const animatedChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const animatedDropdownStyle = useAnimatedStyle(() => ({
    height: dropdownHeight.value,
    opacity: opacity.value,
  }));

  const toggleDropdown = () => {
    if (disabled) return;
    
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    
    rotation.value = withSpring(newIsOpen ? 180 : 0, { damping: 15, stiffness: 300 });
    dropdownHeight.value = withTiming(newIsOpen ? Math.min(maxHeight, filteredOptions.length * 48) : 0, { duration: 300 });
    opacity.value = withTiming(newIsOpen ? 1 : 0, { duration: 300 });
  };

  const handleSelect = (optionValue: string) => {
    onSelect(optionValue);
    setIsOpen(false);
    setSearchText('');
    rotation.value = withSpring(0, { damping: 15, stiffness: 300 });
    dropdownHeight.value = withTiming(0, { duration: 300 });
    opacity.value = withTiming(0, { duration: 300 });
  };

  const containerStyle: ViewStyle = {
    marginBottom: DesignSystem.spacing[4],
    ...style,
  };

  const triggerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: error 
      ? DesignSystem.colors.error[500] 
      : isOpen 
        ? DesignSystem.colors.primary[500] 
        : DesignSystem.colors.neutral[300],
    borderRadius: DesignSystem.borderRadius.md,
    backgroundColor: disabled ? DesignSystem.colors.neutral[100] : '#ffffff',
    paddingHorizontal: DesignSystem.spacing[4],
    paddingVertical: DesignSystem.spacing[3],
    minHeight: 52,
  };

  const dropdownStyle: ViewStyle = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: DesignSystem.borderRadius.md,
    borderWidth: 1,
    borderColor: DesignSystem.colors.neutral[200],
    marginTop: DesignSystem.spacing[1],
    zIndex: 1000,
    ...DesignSystem.shadows.lg,
    overflow: 'hidden',
  };

  const optionStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DesignSystem.spacing[4],
    paddingVertical: DesignSystem.spacing[3],
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: DesignSystem.colors.neutral[100],
  };

  return (
    <View style={containerStyle}>
      {label && (
        <Text
          style={{
            fontSize: DesignSystem.typography.fontSizes.sm,
            fontWeight: DesignSystem.typography.fontWeights.medium,
            color: error ? DesignSystem.colors.error[500] : DesignSystem.colors.neutral[700],
            marginBottom: DesignSystem.spacing[2],
          }}
        >
          {label}
        </Text>
      )}

      <View style={{ position: 'relative' }}>
        <TouchableOpacity
          style={triggerStyle}
          onPress={toggleDropdown}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            {selectedOption?.icon && (
              <View style={{ marginRight: DesignSystem.spacing[2] }}>
                {selectedOption.icon}
              </View>
            )}
            <Text
              style={{
                fontSize: DesignSystem.typography.fontSizes.base,
                color: selectedOption 
                  ? DesignSystem.colors.neutral[900] 
                  : DesignSystem.colors.neutral[500],
                flex: 1,
              }}
              numberOfLines={1}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </Text>
          </View>

          <Animated.View style={animatedChevronStyle}>
            <ChevronDown 
              size={20} 
              color={DesignSystem.colors.neutral[500]} 
            />
          </Animated.View>
        </TouchableOpacity>

        <Animated.View style={[dropdownStyle, animatedDropdownStyle]}>
          <FlatList
            data={filteredOptions}
            keyExtractor={(item) => item.value}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[
                  optionStyle,
                  index === filteredOptions.length - 1 && { borderBottomWidth: 0 },
                  item.value === value && { backgroundColor: DesignSystem.colors.primary[50] },
                ]}
                onPress={() => handleSelect(item.value)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  {item.icon && (
                    <View style={{ marginRight: DesignSystem.spacing[2] }}>
                      {item.icon}
                    </View>
                  )}
                  <Text
                    style={{
                      fontSize: DesignSystem.typography.fontSizes.base,
                      color: item.value === value 
                        ? DesignSystem.colors.primary[700] 
                        : DesignSystem.colors.neutral[900],
                      fontWeight: item.value === value 
                        ? DesignSystem.typography.fontWeights.medium 
                        : DesignSystem.typography.fontWeights.normal,
                    }}
                  >
                    {item.label}
                  </Text>
                </View>

                {item.value === value && (
                  <Check 
                    size={18} 
                    color={DesignSystem.colors.primary[500]} 
                  />
                )}
              </TouchableOpacity>
            )}
          />
        </Animated.View>
      </View>

      {error && (
        <Text
          style={{
            color: DesignSystem.colors.error[500],
            fontSize: DesignSystem.typography.fontSizes.sm,
            marginTop: DesignSystem.spacing[1],
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
};