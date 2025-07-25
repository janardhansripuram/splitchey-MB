import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, HelperText, Surface, Text, TextInput, useTheme } from 'react-native-paper';
// import { getExpenseById, updateExpense } from '../firebase/firestore'; // TODO: Implement

const categories = [
  'Food', 'Transport', 'Shopping', 'Groceries', 'Bills', 'Entertainment', 'Other'
];

export default function EditExpenseScreen() {
  const { expenseId } = useLocalSearchParams();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    const fetchExpense = async () => {
      setLoading(true);
      try {
        // const data = await getExpenseById(expenseId as string);
        // setAmount(data.amount.toString());
        // setDescription(data.description);
        // setCategory(data.category);
        // setDate(data.date);
        setAmount('42.00');
        setDescription('Sample Expense');
        setCategory('Food');
        setDate('2024-07-19');
      } catch (e) {
        Alert.alert('Error', 'Failed to load expense.');
      }
      setLoading(false);
    };
    if (expenseId) fetchExpense();
  }, [expenseId]);

  const handleSave = async () => {
    if (!amount || isNaN(Number(amount))) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }
    setSaving(true);
    try {
      // await updateExpense(...)
      Alert.alert('Success', 'Expense updated!');
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Failed to update expense.');
    }
    setSaving(false);
  };

  if (loading) {
    return <Surface style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><Text>Loading...</Text></Surface>;
  }

  return (
    <Surface style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text variant="headlineLarge" style={{ color: colors.primary, fontWeight: 'bold', marginBottom: 24 }}>
        Edit Expense
      </Text>
      <View style={{ width: '100%', marginBottom: 16 }}>
        <TextInput
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          style={{ marginBottom: 12, backgroundColor: colors.background }}
          mode="outlined"
        />
        <HelperText type="info" visible={true}>
          Enter the amount in your default currency.
        </HelperText>
        <TextInput
          label="Description"
          value={description}
          onChangeText={setDescription}
          style={{ marginBottom: 12, backgroundColor: colors.background }}
          mode="outlined"
        />
        <TextInput
          label="Category"
          value={category}
          onChangeText={setCategory}
          style={{ marginBottom: 12, backgroundColor: colors.background }}
          mode="outlined"
          right={<TextInput.Icon icon="menu-down" />}
        />
        <TextInput
          label="Date"
          value={date}
          onChangeText={setDate}
          style={{ marginBottom: 20, backgroundColor: colors.background }}
          mode="outlined"
        />
        <Button mode="contained" onPress={handleSave} loading={saving} style={{ marginTop: 8 }}>
          Save Changes
        </Button>
        <Button mode="text" onPress={() => router.back()} style={{ marginTop: 8 }}>
          Cancel
        </Button>
      </View>
    </Surface>
  );
} 