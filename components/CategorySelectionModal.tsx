import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Dimensions, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Modal, Portal, useTheme } from 'react-native-paper';
import { Category, getCategories } from '../constants/categories';

interface CategorySelectionModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSelect: (category: string) => void;
  selectedValue: string;
  type?: 'expense' | 'income';
  title?: string;
}

export const CategorySelectionModal: React.FC<CategorySelectionModalProps> = ({
  visible,
  onDismiss,
  onSelect,
  selectedValue,
  type = 'expense',
  title = 'Select Category'
}) => {
  const { colors } = useTheme();
  const categories = getCategories(type);

  const handleSelect = (category: Category) => {
    onSelect(category.value);
    onDismiss();
  };

  const screenHeight = Dimensions.get('window').height;
  const maxModalHeight = screenHeight * 0.7; // 70% of screen height

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={{
          margin: 20,
          height: maxModalHeight,
          backgroundColor: colors.surface,
          borderRadius: 16,
        }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ padding: 20, paddingBottom: 0 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 20, marginBottom: 16, color: colors.primary }}>
              {title}
            </Text>
          </View>
          
          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.value}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  backgroundColor: cat.value === selectedValue ? colors.primaryContainer : 'transparent',
                  marginBottom: 4,
                }}
                onPress={() => handleSelect(cat)}
              >
                <MaterialCommunityIcons
                  name={cat.icon}
                  size={20}
                  color={cat.value === selectedValue ? colors.primary : colors.onSurfaceVariant}
                  style={{ marginRight: 12 }}
                />
                <Text style={{
                  fontSize: 17,
                  color: cat.value === selectedValue ? colors.primary : colors.onSurface,
                  fontWeight: cat.value === selectedValue ? 'bold' : 'normal'
                }}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </Portal>
  );
}; 