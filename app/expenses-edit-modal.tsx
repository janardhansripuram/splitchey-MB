import { ModernInput } from '../components/ui/ModernInput';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import React, { useEffect, useState } from 'react';
import { Image, Keyboard, ScrollView, TouchableOpacity, View, Platform } from 'react-native';
import { ActivityIndicator, Divider, Modal, Portal, Snackbar, Switch, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModernButton } from '../components/ui/ModernButton';
import { CategorySelectionModal } from '../components/CategorySelectionModal';
import { EnhancedDatePicker } from '../components/ui/EnhancedDatePicker';
import { SUPPORTED_CURRENCIES } from '../constants/types';
import { getCategoryIcon, getCategoryLabel } from '../constants/categories';
import { updateExpense } from '../firebase/firestore';
import { useAuth } from '../hooks/useAuth';

export default function ExpensesEditModal({ 
  visible, 
  onClose, 
  expense, 
  onSave, 
  loading 
}: { 
  visible: boolean; 
  onClose: () => void; 
  expense: any; 
  onSave: (updatedExpense: any) => void; 
  loading: boolean; 
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { authUser } = useAuth();

  // Form state
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [currencyModal, setCurrencyModal] = useState(false);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [recurrence, setRecurrence] = useState('none');
  const [recurrenceModal, setRecurrenceModal] = useState(false);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: '' });

  // Error states
  const [amountError, setAmountError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [currencyError, setCurrencyError] = useState('');
  const [dateError, setDateError] = useState('');
  const [formError, setFormError] = useState('');

  // Initialize form with expense data
  useEffect(() => {
    if (expense) {
      setAmount(expense.amount?.toString() || '');
      setDescription(expense.description || '');
      setCategory(expense.category || 'Food');
      setCurrency(expense.currency || 'USD');
      setDate(expense.date || format(new Date(), 'yyyy-MM-dd'));
      setNotes(expense.notes || '');
      setTags(expense.tags ? expense.tags.join(', ') : '');
      setRecurrence(expense.recurrence || 'none');
      setRecurrenceEndDate(expense.recurrenceEndDate || '');
    }
  }, [expense]);

  // Validation
  const validateForm = () => {
    let hasError = false;
    setAmountError('');
    setDescriptionError('');
    setCategoryError('');
    setCurrencyError('');
    setDateError('');
    setFormError('');

    if (!amount.trim()) {
      setAmountError('Amount is required');
      hasError = true;
    } else if (isNaN(Number(amount)) || Number(amount) <= 0) {
      setAmountError('Please enter a valid amount');
      hasError = true;
    }

    if (!description.trim()) {
      setDescriptionError('Description is required');
      hasError = true;
    }

    if (!category) {
      setCategoryError('Category is required');
      hasError = true;
    }

    if (!currency) {
      setCurrencyError('Currency is required');
      hasError = true;
    }

    if (!date) {
      setDateError('Date is required');
      hasError = true;
    }

    return !hasError;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const updatedExpense = {
        amount: amount,
        description: description.trim(),
        category,
        currency,
        date,
        notes: notes.trim(),
        tags: tags.trim() ? tags.split(',').map((tag: string) => tag.trim()) : [],
        recurrence,
        recurrenceEndDate: recurrenceEndDate || null,
        updatedAt: new Date(),
      };

      await onSave(updatedExpense);
      setSnackbar({ visible: true, message: 'Expense updated successfully!' });
      
      // Reset form
      setAmount('');
      setDescription('');
      setCategory('Food');
      setCurrency('USD');
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setNotes('');
      setTags('');
      setRecurrence('none');
      setRecurrenceEndDate('');
      
      onClose();
    } catch (error) {
      setFormError('Failed to update expense. Please try again.');
      console.error('Update expense error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  if (!expense) return null;

  if (!visible) return null;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleClose}
        contentContainerStyle={{
          backgroundColor: colors.elevation.level2,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: insets.bottom + 24,
          paddingTop: 20,
          minHeight: 580,
          maxHeight: '90%',
        }}
        style={{
          justifyContent: 'flex-end',
          margin: 0,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <View style={{
            width: 44, height: 5, borderRadius: 3, backgroundColor: colors.outlineVariant || '#ccc', marginTop: 8, marginBottom: 8,
          }} />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.primary, marginBottom: 16, textAlign: 'center' }}>
            Edit Expense
          </Text>
          <Divider style={{ marginBottom: 20 }} />
          {/* Amount */}
          <ModernInput
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            leftIcon={<MaterialCommunityIcons name="currency-usd" size={22} color={colors.primary} />}
            style={{ marginBottom: 12 }}
            error={amountError}
          />

          {/* Currency Picker */}
          <TouchableOpacity 
            onPress={() => { setCurrencyModal(true); Keyboard.dismiss(); }} 
            activeOpacity={0.7}
            style={{ marginBottom: 12 }}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 2,
              borderRadius: 12,
              backgroundColor: colors.surface,
              paddingHorizontal: 16,
              minHeight: 56,
              borderColor: currencyError ? colors.error : colors.outline,
            }}>
              <MaterialCommunityIcons name="currency-usd" size={22} color={colors.primary} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 2 }}>Currency</Text>
                <Text style={{ fontSize: 16, color: colors.onSurface }}>{currency}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={22} color={colors.primary} />
            </View>
          </TouchableOpacity>

          {/* Description */}
          <ModernInput
            label="Description"
            value={description}
            onChangeText={setDescription}
            leftIcon={<MaterialCommunityIcons name="text" size={22} color={colors.primary} />}
            style={{ marginBottom: 12 }}
            error={descriptionError}
          />

          {/* Category Selection */}
          <TouchableOpacity 
            onPress={() => { setShowCategoryModal(true); Keyboard.dismiss(); }} 
            activeOpacity={0.7}
            style={{ marginBottom: 12 }}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 2,
              borderRadius: 12,
              backgroundColor: colors.surface,
              paddingHorizontal: 16,
              minHeight: 56,
              borderColor: categoryError ? colors.error : colors.outline,
            }}>
              <MaterialCommunityIcons name={getCategoryIcon(category)} size={22} color={colors.primary} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 2 }}>Category</Text>
                <Text style={{ fontSize: 16, color: colors.onSurface }}>{getCategoryLabel(category)}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={22} color={colors.primary} />
            </View>
          </TouchableOpacity>

          {/* Date Picker */}
          <EnhancedDatePicker
            value={date}
            onValueChange={setDate}
            label="Date"
            placeholder="Select expense date"
            style={{ marginBottom: 12 }}
            error={dateError}
          />

          {/* Notes */}
          <ModernInput
            label="Notes (Optional)"
            value={notes}
            onChangeText={setNotes}
            leftIcon={<MaterialCommunityIcons name="note-text" size={22} color={colors.primary} />}
            style={{ marginBottom: 12 }}
            multiline
            numberOfLines={3}
          />

          {/* Tags */}
          <ModernInput
            label="Tags (Optional)"
            value={tags}
            onChangeText={setTags}
            leftIcon={<MaterialCommunityIcons name="tag" size={22} color={colors.primary} />}
            style={{ marginBottom: 12 }}
          />

          {/* Recurrence Selection */}
          <TouchableOpacity 
            onPress={() => { setRecurrenceModal(true); Keyboard.dismiss(); }} 
            activeOpacity={0.7}
            style={{ marginBottom: 12 }}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 2,
              borderRadius: 12,
              backgroundColor: colors.surface,
              paddingHorizontal: 16,
              minHeight: 56,
              borderColor: colors.outline,
            }}>
              <MaterialCommunityIcons name="repeat" size={22} color={colors.primary} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 2 }}>Recurrence</Text>
                <Text style={{ fontSize: 16, color: colors.onSurface }}>
                  {recurrence === 'none' ? 'None' : recurrence.charAt(0).toUpperCase() + recurrence.slice(1)}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={22} color={colors.primary} />
            </View>
          </TouchableOpacity>

          {formError ? (
            <Text style={{ color: colors.error, fontWeight: 'bold', textAlign: 'center', marginVertical: 8 }}>
              {formError}
            </Text>
          ) : null}

          <ModernButton
            onPress={handleSubmit}
            loading={saving}
            style={{ borderRadius: 12, marginTop: 20, marginBottom: 12, height: 52 }}
            title="Update Expense"
            disabled={saving}
            variant="primary"
          />
          <ModernButton
            onPress={handleClose}
            style={{ borderRadius: 12, marginBottom: 8, height: 52 }}
            title="Cancel"
            variant="outline"
          />
        </ScrollView>

        {/* Modals */}
        <CategorySelectionModal
          visible={showCategoryModal}
          onDismiss={() => setShowCategoryModal(false)}
          onSelect={setCategory}
          selectedValue={category}
          type="expense"
          title="Select Category"
        />

        <Portal>
          <Modal
            visible={currencyModal}
            onDismiss={() => setCurrencyModal(false)}
            contentContainerStyle={{
              margin: 20,
              padding: 20,
              backgroundColor: colors.surface,
              borderRadius: 16,
            }}
          >
            <Text style={{ fontWeight: 'bold', fontSize: 20, marginBottom: 16, color: colors.primary }}>Select Currency</Text>
            {SUPPORTED_CURRENCIES.map(curr => (
              <TouchableOpacity
                key={curr.code}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  backgroundColor: curr.code === currency ? colors.primaryContainer : 'transparent',
                  marginBottom: 4,
                }}
                onPress={() => {
                  setCurrency(curr.code);
                  setCurrencyModal(false);
                }}
              >
                <MaterialCommunityIcons
                  name="currency-usd"
                  size={20}
                  color={curr.code === currency ? colors.primary : colors.onSurfaceVariant}
                  style={{ marginRight: 12 }}
                />
                <Text style={{
                  fontSize: 17,
                  color: curr.code === currency ? colors.primary : colors.onSurface,
                  fontWeight: curr.code === currency ? 'bold' : 'normal'
                }}>
                  {curr.code} - {curr.name}
                </Text>
              </TouchableOpacity>
            ))}
          </Modal>
        </Portal>

        <Portal>
          <Modal
            visible={recurrenceModal}
            onDismiss={() => setRecurrenceModal(false)}
            contentContainerStyle={{
              margin: 20,
              padding: 20,
              backgroundColor: colors.surface,
              borderRadius: 16,
            }}
          >
            <Text style={{ fontWeight: 'bold', fontSize: 20, marginBottom: 16, color: colors.primary }}>Select Recurrence</Text>
            {[
              { label: 'None', value: 'none' },
              { label: 'Daily', value: 'daily' },
              { label: 'Weekly', value: 'weekly' },
              { label: 'Monthly', value: 'monthly' },
              { label: 'Yearly', value: 'yearly' },
            ].map(option => (
              <TouchableOpacity
                key={option.value}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  backgroundColor: option.value === recurrence ? colors.primaryContainer : 'transparent',
                  marginBottom: 4,
                }}
                onPress={() => {
                  setRecurrence(option.value);
                  setRecurrenceModal(false);
                }}
              >
                <MaterialCommunityIcons
                  name="repeat"
                  size={20}
                  color={option.value === recurrence ? colors.primary : colors.onSurfaceVariant}
                  style={{ marginRight: 12 }}
                />
                <Text style={{
                  fontSize: 17,
                  color: option.value === recurrence ? colors.primary : colors.onSurface,
                  fontWeight: option.value === recurrence ? 'bold' : 'normal'
                }}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </Modal>
        </Portal>

        <Snackbar
          visible={snackbar.visible}
          onDismiss={() => setSnackbar({ visible: false, message: '' })}
          duration={2500}
          style={{ backgroundColor: colors.primary }}
        >
          {snackbar.message}
        </Snackbar>
        {saving && <ActivityIndicator style={{ position: 'absolute', top: '50%', left: '50%' }}/> }
      </Modal>
    </Portal>
  );
} 