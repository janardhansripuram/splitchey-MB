import React, { useState } from 'react';
import { View, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import { Text, useTheme, Portal } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { ModernInput } from './ModernInput';

interface EnhancedDatePickerProps {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  style?: any;
}

export const EnhancedDatePicker: React.FC<EnhancedDatePickerProps> = ({
  value,
  onValueChange,
  label,
  placeholder = "Select date",
  disabled = false,
  error,
  style,
}) => {
  const { colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(value ? parseISO(value) : new Date());

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (selectedDate) {
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        onValueChange(formattedDate);
      }
    } else {
      // iOS: Update temp date for preview
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  };

  const handleConfirm = () => {
    setShowPicker(false);
    const formattedDate = format(tempDate, 'yyyy-MM-dd');
    onValueChange(formattedDate);
  };

  const handleCancel = () => {
    setShowPicker(false);
    // Reset temp date to original value
    setTempDate(value ? parseISO(value) : new Date());
  };

  const displayValue = value ? format(parseISO(value), 'MMM dd, yyyy') : '';

  return (
    <>
      <TouchableOpacity 
        onPress={() => !disabled && setShowPicker(true)} 
        activeOpacity={0.7}
        style={style}
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
          <MaterialCommunityIcons 
            name="calendar" 
            size={22} 
            color={colors.primary} 
            style={{ marginRight: 12 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 2 }}>{label}</Text>
            <Text style={{ fontSize: 16, color: colors.onSurface }}>
              {displayValue || placeholder}
            </Text>
          </View>
          <MaterialCommunityIcons 
            name="calendar" 
            size={22} 
            color={colors.primary} 
          />
        </View>
      </TouchableOpacity>

      {Platform.OS === 'ios' ? (
        <Portal>
          <Modal
            visible={showPicker}
            transparent={true}
            animationType="slide"
            onRequestClose={handleCancel}
          >
            <View style={styles.modalOverlay}>
              <View style={[
                styles.modalContent,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.outline,
                }
              ]}>
                {/* Header */}
                <View style={[
                  styles.modalHeader,
                  {
                    borderBottomColor: colors.outline,
                  }
                ]}>
                  <TouchableOpacity onPress={handleCancel}>
                    <Text style={[
                      styles.headerButton,
                      { color: colors.primary }
                    ]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <Text style={[
                    styles.headerTitle,
                    { color: colors.onSurface }
                  ]}>
                    Select Date
                  </Text>
                  <TouchableOpacity onPress={handleConfirm}>
                    <Text style={[
                      styles.headerButton,
                      { color: colors.primary }
                    ]}>
                      Done
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Date Picker */}
                <View style={styles.pickerContainer}>
                  <DateTimePicker
                    value={tempDate}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    style={styles.picker}
                    textColor={colors.onSurface}
                    accentColor={colors.primary}
                  />
                </View>
              </View>
            </View>
          </Modal>
        </Portal>
      ) : (
        showPicker && (
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            style={styles.androidPicker}
          />
        )
      )}
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerButton: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  pickerContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  picker: {
    width: 320,
    height: 200,
  },
  androidPicker: {
    backgroundColor: 'transparent',
  },
}); 