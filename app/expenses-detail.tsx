import React, { useEffect, useState } from 'react';
import { View, Alert } from 'react-native';
import { Surface, Text, Button, useTheme, Card } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
// import { getExpenseById, deleteExpense } from '../firebase/firestore'; // TODO: Implement

export default function ExpenseDetailScreen() {
  const { expenseId } = useLocalSearchParams();
  const [expense, setExpense] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    const fetchExpense = async () => {
      setLoading(true);
      try {
        // const data = await getExpenseById(expenseId as string);
        // setExpense(data);
        setExpense({
          amount: '42.00',
          description: 'Sample Expense',
          category: 'Food',
          date: '2024-07-19',
        }); // Mock data for now
      } catch (e) {
        Alert.alert('Error', 'Failed to load expense.');
      }
      setLoading(false);
    };
    if (expenseId) fetchExpense();
  }, [expenseId]);

  const handleDelete = async () => {
    Alert.alert('Delete Expense', 'Are you sure you want to delete this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            // await deleteExpense(expenseId as string);
            Alert.alert('Deleted', 'Expense deleted.');
            router.back();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete expense.');
          }
        }
      }
    ]);
  };

  const handleEdit = () => {
    router.push(`/expenses-edit?expenseId=${expenseId}`);
  };

  if (loading) {
    return <Surface style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><Text>Loading...</Text></Surface>;
  }

  if (!expense) {
    return <Surface style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><Text>Expense not found.</Text></Surface>;
  }

  return (
    <Surface style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Card style={{ width: '100%', backgroundColor: colors.elevation.level1, padding: 24 }}>
        <Text variant="headlineMedium" style={{ color: colors.primary, fontWeight: 'bold', marginBottom: 16 }}>Expense Details</Text>
        <Text variant="titleLarge" style={{ marginBottom: 8 }}>Amount: {expense.amount}</Text>
        <Text variant="bodyLarge" style={{ marginBottom: 8 }}>Description: {expense.description}</Text>
        <Text variant="bodyLarge" style={{ marginBottom: 8 }}>Category: {expense.category}</Text>
        <Text variant="bodyLarge" style={{ marginBottom: 16 }}>Date: {expense.date}</Text>
        <Button mode="contained" onPress={handleEdit} style={{ marginBottom: 8 }}>Edit</Button>
        <Button mode="contained" buttonColor={colors.error} onPress={handleDelete}>Delete</Button>
        <Button mode="text" onPress={() => router.back()} style={{ marginTop: 8 }}>Back</Button>
      </Card>
    </Surface>
  );
} 