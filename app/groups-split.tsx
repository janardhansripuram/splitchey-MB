import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { ActivityIndicator, Button, Card, HelperText, List, RadioButton, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { createSplitExpense, Expense, getExpensesByGroupId, getGroupDetails, Group, SplitParticipant } from '../firebase/firestore';

const SPLIT_METHODS = [
  { label: 'Equally', value: 'equally' },
  { label: 'By Amount', value: 'byAmount' },
  { label: 'By Percentage', value: 'byPercentage' },
];

type SplitMethod = 'equally' | 'byAmount' | 'byPercentage';

export default function GroupSplitScreen() {
  const { groupId } = useLocalSearchParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equally');
  const [participants, setParticipants] = useState<SplitParticipant[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const groupData = await getGroupDetails(groupId as string);
        const expensesData = await getExpensesByGroupId(groupId as string);
        setGroup(groupData);
        setExpenses(expensesData);
      } catch (e) {
        Alert.alert('Error', 'Failed to load group or expenses.');
      }
      setLoading(false);
    };
    if (groupId) fetchData();
  }, [groupId]);

  // Initialize participants when expense is selected
  useEffect(() => {
    if (selectedExpense && group) {
      setParticipants(
        group.memberDetails.map((m: any) => ({
          userId: m.uid,
          displayName: m.displayName,
          email: m.email,
          amountOwed: splitMethod === 'equally' ? selectedExpense.amount / group.memberDetails.length : 0,
          settlementStatus: 'unsettled',
          percentage: splitMethod === 'byPercentage' ? 100 / group.memberDetails.length : undefined,
        }))
      );
    }
  }, [selectedExpense, group, splitMethod]);

  const handleParticipantChange = (index: number, field: 'amountOwed' | 'percentage', value: string) => {
    setParticipants(prev => prev.map((p, i) =>
      i === index ? { ...p, [field]: Number(value) } : p
    ));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!selectedExpense || !group) return;
    // Validation
    if (splitMethod === 'byAmount') {
      const sum = participants.reduce((acc, p) => acc + (p.amountOwed || 0), 0);
      if (Math.abs(sum - selectedExpense.amount) > 0.01) {
        setError('Sum of amounts must equal total expense.');
        return;
      }
    }
    if (splitMethod === 'byPercentage') {
      const sum = participants.reduce((acc, p) => acc + (p.percentage || 0), 0);
      if (Math.abs(sum - 100) > 0.01) {
        setError('Sum of percentages must equal 100%.');
        return;
      }
    }
    setSubmitting(true);
    try {
      await createSplitExpense({
        originalExpenseId: selectedExpense.id,
        originalExpenseDescription: selectedExpense.description,
        currency: selectedExpense.currency,
        splitMethod,
        totalAmount: selectedExpense.amount,
        paidBy: selectedExpense.paidById,
        participants,
        involvedUserIds: participants.map(p => p.userId),
        groupId: group.id,
        groupName: group.name,
        notes,
      });
      Alert.alert('Success', 'Expense split successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      setError('Failed to split expense.');
    }
    setSubmitting(false);
  };

  if (loading) {
    return <Surface style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><ActivityIndicator animating color={colors.primary} size="large" /><Text>Loading...</Text></Surface>;
  }

  if (!group) {
    return <Surface style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><Text>Group not found.</Text></Surface>;
  }

  return (
    <Surface style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Text variant="headlineMedium" style={{ marginBottom: 16 }}>Split Expense</Text>
        <Text variant="titleLarge" style={{ marginBottom: 8 }}>Select Expense</Text>
        <List.Section>
          {expenses.map(exp => (
            <List.Item
              key={exp.id}
              title={exp.description}
              description={`Amount: ${exp.amount} ${exp.currency}`}
              left={props => <List.Icon {...props} icon="currency-usd" />}
              onPress={() => setSelectedExpense(exp)}
              style={{ backgroundColor: selectedExpense?.id === exp.id ? colors.secondaryContainer : undefined }}
            />
          ))}
        </List.Section>
        {selectedExpense && (
          <>
            <Text variant="titleLarge" style={{ marginTop: 16, marginBottom: 8 }}>Split Method</Text>
            <RadioButton.Group onValueChange={v => setSplitMethod(v as SplitMethod)} value={splitMethod}>
              {SPLIT_METHODS.map(method => (
                <RadioButton.Item key={method.value} label={method.label} value={method.value} />
              ))}
            </RadioButton.Group>
            <Text variant="titleLarge" style={{ marginTop: 16, marginBottom: 8 }}>Participants</Text>
            {participants.map((p, i) => (
              <Card key={p.userId} style={{ marginBottom: 8 }}>
                <Card.Content>
                  <Text>{p.displayName} ({p.email})</Text>
                  {splitMethod === 'equally' ? (
                    <Text>Owes: {selectedExpense.amount / participants.length} {selectedExpense.currency}</Text>
                  ) : splitMethod === 'byAmount' ? (
                    <TextInput
                      label="Amount Owed"
                      value={String(p.amountOwed)}
                      onChangeText={v => handleParticipantChange(i, 'amountOwed', v)}
                      keyboardType="numeric"
                      style={{ marginTop: 8 }}
                    />
                  ) : (
                    <TextInput
                      label="Percentage"
                      value={String(p.percentage)}
                      onChangeText={v => handleParticipantChange(i, 'percentage', v)}
                      keyboardType="numeric"
                      style={{ marginTop: 8 }}
                    />
                  )}
                </Card.Content>
              </Card>
            ))}
            <TextInput
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              style={{ marginTop: 16, marginBottom: 8 }}
              multiline
            />
            {error && <HelperText type="error" visible>{error}</HelperText>}
            <Button mode="contained" loading={submitting} onPress={handleSubmit} style={{ marginTop: 16 }}>Split Expense</Button>
          </>
        )}
      </ScrollView>
    </Surface>
  );
} 