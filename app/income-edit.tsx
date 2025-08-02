import { MaterialCommunityIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { format } from 'date-fns';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { Button, Checkbox, Divider, Portal, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SUPPORTED_CURRENCIES } from '../constants/types';
import { updateIncome } from '../firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { CurrencySelectionModal } from '../components/CurrencySelectionModal';
import { EnhancedDatePicker } from '../components/ui/EnhancedDatePicker';

interface EditIncomeSheetProps {
  visible: boolean;
  income: any | null;
  onDismiss: () => void;
  onSave: (incomeData: any) => void;
  loading?: boolean;
}

const recurrenceOptions = [
  { value: 'none', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export function EditIncomeSheet({ visible, income, onDismiss, onSave, loading }: EditIncomeSheetProps) {
  const { authUser } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Form state
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  // UI state
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation state
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const snapPoints = useMemo(() => ['90%'], []);

  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible]);

  // Populate form when income data is available
  useEffect(() => {
    if (income) {
      setSource(income.source || '');
      setAmount(income.amount?.toString() || '');
      setCurrency(income.currency || 'USD');
      setDate(income.date || format(new Date(), 'yyyy-MM-dd'));
      setNotes(income.notes || '');
      setIsRecurring(income.isRecurring || false);
      setRecurrence(income.recurrence || 'none');
      setRecurrenceEndDate(income.recurrenceEndDate || '');
    }
  }, [income]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!source.trim()) {
      newErrors.source = 'Source is required';
    }

    if (!amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      newErrors.amount = 'Amount must be a positive number';
    }

    if (!date) {
      newErrors.date = 'Date is required';
    }

    if (isRecurring) {
      if (recurrence === 'none') {
        newErrors.recurrence = 'Recurrence frequency is required';
      }
      if (recurrenceEndDate && new Date(recurrenceEndDate) < new Date(date)) {
        newErrors.recurrenceEndDate = 'End date cannot be before start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !authUser || !income?.id) return;

    setIsSubmitting(true);
    try {
      const incomeData = {
        source: source.trim(),
        amount: amount.trim(),
        currency,
        date,
        notes: notes.trim(),
        isRecurring,
        recurrence: isRecurring ? recurrence : 'none',
        recurrenceEndDate: isRecurring && recurrenceEndDate ? recurrenceEndDate : undefined,
      };

      await updateIncome(income.id, incomeData);
      
      onSave(incomeData);
      onDismiss();
    } catch (error) {
      console.error('Failed to update income:', error);
      Alert.alert('Error', 'Failed to update income. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(format(selectedDate, 'yyyy-MM-dd'));
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      setRecurrenceEndDate(format(selectedDate, 'yyyy-MM-dd'));
    }
  };

  const selectedCurrency = SUPPORTED_CURRENCIES.find(c => c.code === currency);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
      />
    ),
    []
  );

  if (!income) return null;

  return (
    <Portal>
      <BottomSheet
        ref={bottomSheetRef}
        index={visible ? 0 : -1}
        snapPoints={snapPoints}
        onClose={onDismiss}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: colors.outline, width: 40, height: 4 }}
        backgroundStyle={{ backgroundColor: colors.surface }}
      >
        <BottomSheetScrollView
          contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text variant="headlineSmall" style={styles.title}>
              Edit Income
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Update your income details
            </Text>
          </View>

          <Surface style={styles.form} elevation={0}>
            {/* Source */}
            <View style={styles.field}>
              <Text variant="labelLarge" style={styles.label}>
                Source *
              </Text>
              <TextInput
                mode="outlined"
                value={source}
                onChangeText={setSource}
                placeholder="e.g., Salary, Freelance, Investment"
                error={!!errors.source}
                style={styles.input}
              />
              {errors.source && (
                <Text variant="bodySmall" style={styles.errorText}>
                  {errors.source}
                </Text>
              )}
            </View>

            {/* Amount */}
            <View style={styles.field}>
              <Text variant="labelLarge" style={styles.label}>
                Amount *
              </Text>
              <View style={styles.amountRow}>
                <TextInput
                  mode="outlined"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  keyboardType="numeric"
                  error={!!errors.amount}
                  style={[styles.input, styles.amountInput]}
                />
                <Button
                  mode="outlined"
                  onPress={() => setShowCurrencyModal(true)}
                  style={styles.currencyButton}
                  contentStyle={styles.currencyButtonContent}
                >
                  {selectedCurrency?.symbol || currency}
                </Button>
              </View>
              {errors.amount && (
                <Text variant="bodySmall" style={styles.errorText}>
                  {errors.amount}
                </Text>
              )}
            </View>

            {/* Enhanced Date Picker */}
            <View style={styles.field}>
              <Text variant="labelLarge" style={styles.label}>
                Date *
              </Text>
              <EnhancedDatePicker
                value={date}
                onValueChange={setDate}
                label=""
                placeholder="Select income date"
                error={errors.date}
              />
            </View>

            {/* Notes */}
            <View style={styles.field}>
              <Text variant="labelLarge" style={styles.label}>
                Notes
              </Text>
              <TextInput
                mode="outlined"
                value={notes}
                onChangeText={setNotes}
                placeholder="Additional notes..."
                multiline
                numberOfLines={3}
                style={styles.input}
              />
            </View>

            {/* Recurring Income */}
            <View style={styles.field}>
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={isRecurring ? 'checked' : 'unchecked'}
                  onPress={() => setIsRecurring(!isRecurring)}
                />
                <Text variant="labelLarge" style={styles.checkboxLabel}>
                  Recurring Income
                </Text>
              </View>
            </View>

            {isRecurring && (
              <>
                {/* Recurrence Frequency */}
                <View style={styles.field}>
                  <Text variant="labelLarge" style={styles.label}>
                    Frequency *
                  </Text>
                  <View style={styles.recurrenceGrid}>
                    {recurrenceOptions.map((option) => (
                      <Button
                        key={option.value}
                        mode={recurrence === option.value ? 'contained' : 'outlined'}
                        onPress={() => setRecurrence(option.value)}
                        style={styles.recurrenceButton}
                        compact
                      >
                        {option.label}
                      </Button>
                    ))}
                  </View>
                  {errors.recurrence && (
                    <Text variant="bodySmall" style={styles.errorText}>
                      {errors.recurrence}
                    </Text>
                  )}
                </View>

                {/* Enhanced Recurrence End Date Picker */}
                <View style={styles.field}>
                  <Text variant="labelLarge" style={styles.label}>
                    End Date (Optional)
                  </Text>
                  <EnhancedDatePicker
                    value={recurrenceEndDate}
                    onValueChange={setRecurrenceEndDate}
                    label=""
                    placeholder="Select end date"
                    error={errors.recurrenceEndDate}
                  />
                </View>
              </>
            )}
          </Surface>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={onDismiss}
              style={styles.cancelButton}
              disabled={isSubmitting || loading}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={isSubmitting || loading}
              disabled={isSubmitting || loading}
              style={styles.saveButton}
            >
              Update Income
            </Button>
          </View>
        </BottomSheetScrollView>



        {/* Currency Selection Modal */}
        <CurrencySelectionModal
          visible={showCurrencyModal}
          onClose={() => setShowCurrencyModal(false)}
          onSelect={(selectedCurrency) => {
            setCurrency(selectedCurrency);
            setShowCurrencyModal(false);
          }}
          selectedCurrency={currency}
          currencies={[
            { code: "USD", name: "US Dollar" },
            { code: "EUR", name: "Euro" },
            { code: "GBP", name: "British Pound" },
            { code: "JPY", name: "Japanese Yen" },
            { code: "CAD", name: "Canadian Dollar" },
            { code: "AUD", name: "Australian Dollar" },
            { code: "INR", name: "Indian Rupee" },
            { code: "MYR", name: "Malaysian Ringgit" },
          ]}
        />
      </BottomSheet>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    opacity: 0.7,
  },
  form: {
    marginBottom: 24,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: 'transparent',
  },
  amountRow: {
    flexDirection: 'row',
    gap: 12,
  },
  amountInput: {
    flex: 1,
  },
  currencyButton: {
    minWidth: 80,
  },
  currencyButtonContent: {
    height: 56,
  },
  dateButton: {
    justifyContent: 'flex-start',
  },
  dateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateButtonText: {
    marginLeft: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    marginLeft: 8,
  },
  recurrenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recurrenceButton: {
    flex: 1,
    minWidth: '45%',
  },
  errorText: {
    color: '#d32f2f',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
}); 