import { updateExpense, getExpenseById } from '../firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { format, parseISO } from 'date-fns';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, TouchableOpacity, View, ScrollView } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModernInput } from '../components/ui/ModernInput';
import { ModernCard } from '../components/ui/ModernCard';
import { CategorySelectionModal } from '../components/CategorySelectionModal';
import { EnhancedDatePicker } from '../components/ui/EnhancedDatePicker';
import { getCategoryIcon, getCategoryLabel } from '../constants/categories';

export default function ExpensesEditScreen() {
  const router = useRouter();
  const { expenseId } = useLocalSearchParams();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [expense, setExpense] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [saving, setSaving] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  useEffect(() => {
    if (expenseId) {
      loadExpense();
    }
  }, [expenseId]);

  const loadExpense = async () => {
    try {
      setLoading(true);
      const expenseData = await getExpenseById(expenseId as string);
      if (expenseData) {
        setExpense(expenseData);
        setAmount(expenseData.amount?.toString() || '');
        setDescription(expenseData.description || '');
        setCategory(expenseData.category || 'Food');
        // Handle Firestore Timestamp or string date
        setDate(
          expenseData.date
            ? typeof expenseData.date === 'string'
              ? expenseData.date
              : format(
                  new Date(
                    (expenseData.date as any).seconds
                      ? (expenseData.date as any).seconds * 1000
                      : expenseData.date
                  ),
                  'yyyy-MM-dd'
                )
            : format(new Date(), 'yyyy-MM-dd')
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load expense details.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  // Helper to format date as local YYYY-MM-DD
  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSave = async () => {
    if (!amount || isNaN(Number(amount))) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description.');
      return;
    }
    
    setSaving(true);
    try {
      await updateExpense(expenseId as string, {
        amount: amount, // Keep as string as expected by ExpenseFormData
        description: description.trim(),
        category,
        date, // This is always 'YYYY-MM-DD' in local time
      });
      Alert.alert('Success', 'Expense updated successfully.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert('Error', 'Failed to update expense.');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 16, color: colors.onSurfaceVariant }}>Loading expense details...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Enhanced Header */}
      <View style={{ 
        paddingTop: insets.top + 20, 
        paddingBottom: 20, 
        paddingHorizontal: 20,
        backgroundColor: colors.primary,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: 20,
              padding: 8,
              marginRight: 12,
            }}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 24 }}>
              Edit Expense
            </Text>
            <Text style={{ color: '#fff', opacity: 0.9, fontSize: 16, marginTop: 2 }}>
              Update your expense details
            </Text>
          </View>
        </View>
      </View>

      {/* Enhanced Form */}
      <ScrollView style={{ flex: 1, padding: 20 }} showsVerticalScrollIndicator={false}>
        <ModernCard style={{ marginBottom: 24 }}>
          <View style={{ padding: 20 }}>
            <Text style={{ 
              fontSize: 20, 
              fontWeight: 'bold', 
              color: colors.onSurface, 
              marginBottom: 24,
              textAlign: 'center'
            }}>
              Expense Details
            </Text>

            {/* Amount Input */}
            <ModernInput
              label="Amount"
              placeholder="Enter amount"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              leftIcon={
                <MaterialCommunityIcons 
                  name="currency-usd" 
                  size={20} 
                  color={colors.primary} 
                />
              }
              style={{ marginBottom: 20 }}
            />

            {/* Description Input */}
            <ModernInput
              label="Description"
              placeholder="What was this expense for?"
              value={description}
              onChangeText={setDescription}
              leftIcon={
                <MaterialCommunityIcons 
                  name="text" 
                  size={20} 
                  color={colors.primary} 
                />
              }
              style={{ marginBottom: 20 }}
            />

            {/* Category Selection */}
            <TouchableOpacity 
              onPress={() => setShowCategoryModal(true)} 
              activeOpacity={0.7}
              style={{ marginBottom: 20 }}
            >
              <ModernInput
                label="Category"
                placeholder="Select category"
                value={getCategoryLabel(category)}
                onChangeText={() => {}} // Read-only
                editable={false}
                leftIcon={
                  <MaterialCommunityIcons 
                    name={getCategoryIcon(category)} 
                    size={20} 
                    color={colors.primary} 
                  />
                }
                rightIcon={
                  <MaterialCommunityIcons 
                    name="chevron-down" 
                    size={20} 
                    color={colors.onSurfaceVariant} 
                  />
                }
              />
            </TouchableOpacity>

            {/* Enhanced Date Picker */}
            <EnhancedDatePicker
              value={date}
              onValueChange={setDate}
              label="Date"
              placeholder="Select expense date"
              style={{ marginBottom: 20 }}
            />

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <Button
                mode="contained"
                onPress={handleSave}
                loading={saving}
                disabled={saving || !amount.trim() || !description.trim()}
                style={{ 
                  flex: 1, 
                  borderRadius: 16,
                  backgroundColor: colors.primary,
                  elevation: 4,
                }}
                contentStyle={{ paddingVertical: 12 }}
                labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                mode="outlined"
                onPress={() => router.back()}
                disabled={saving}
                style={{ 
                  flex: 1, 
                  borderRadius: 16,
                  borderColor: colors.outline,
                }}
                contentStyle={{ paddingVertical: 12 }}
                labelStyle={{ fontSize: 16, fontWeight: '600' }}
              >
                Cancel
              </Button>
            </View>

            {saving && (
              <View style={{ 
                alignItems: 'center', 
                marginTop: 16,
                padding: 16,
                backgroundColor: colors.primaryContainer,
                borderRadius: 12,
              }}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ 
                  marginTop: 8, 
                  color: colors.onSurfaceVariant,
                  fontSize: 14,
                }}>
                  Updating expense...
                </Text>
              </View>
            )}
          </View>
        </ModernCard>
      </ScrollView>

      {/* Category Selection Modal */}
      <CategorySelectionModal
        visible={showCategoryModal}
        onDismiss={() => setShowCategoryModal(false)}
        onSelect={setCategory}
        selectedValue={category}
        type="expense"
        title="Select Category"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Styles can be added here if needed
});