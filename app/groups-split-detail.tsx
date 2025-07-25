import React, { useEffect, useState } from 'react';
import { Surface, Text, useTheme, Card, List, Button, ActivityIndicator, HelperText, Dialog, Portal, TextInput, RadioButton } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getSplitExpensesByGroupId, SplitExpense, settleDebtWithWallet, updateSplitExpense, SplitParticipant, getGroupDetails } from '../firebase/firestore';
import { Alert } from 'react-native';
import { useAuth } from '../hooks/useAuth';

const SPLIT_METHODS = [
  { label: 'Equally', value: 'equally' },
  { label: 'By Amount', value: 'byAmount' },
  { label: 'By Percentage', value: 'byPercentage' },
];

type SplitMethod = 'equally' | 'byAmount' | 'byPercentage';

export default function GroupSplitDetailScreen() {
  const { splitId, groupId } = useLocalSearchParams();
  const { authUser } = useAuth();
  const [split, setSplit] = useState<SplitExpense | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editState, setEditState] = useState<any>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const { colors } = useTheme();
  const router = useRouter();
  const [group, setGroup] = useState<any>(null);

  const fetchSplit = async () => {
    setLoading(true);
    setError(null);
    try {
      const splits = await getSplitExpensesByGroupId(groupId as string);
      const found = splits.find(s => s.id === splitId);
      setSplit(found || null);
      if (!found) setError('Split not found.');
    } catch (e) {
      setError('Failed to load split details.');
    }
    setLoading(false);
  };

  // Fetch group details for roles and member info
  useEffect(() => {
    if (groupId) {
      getGroupDetails(groupId as string).then(setGroup);
    }
  }, [groupId]);

  useEffect(() => {
    if (splitId && groupId) fetchSplit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitId, groupId]);

  // Set up edit state when opening edit dialog
  const openEdit = () => {
    if (!split) return;
    setEditState({
      totalAmount: split.totalAmount,
      payerId: split.paidBy,
      splitMethod: split.splitMethod,
      notes: split.notes || '',
      participants: split.participants.map(p => ({
        userId: p.userId,
        amountOwed: p.amountOwed,
        percentage: p.percentage,
      })),
    });
    setEditError(null);
    setEditOpen(true);
  };

  const handleSettle = async (userId: string) => {
    setSettling(userId);
    try {
      await settleDebtWithWallet(splitId as string, userId);
      await fetchSplit();
      Alert.alert('Success', 'Debt settled!');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to settle debt.');
    }
    setSettling(null);
  };

  const handleEditChange = (index: number, field: 'amountOwed' | 'percentage', value: string) => {
    setEditState((prev: any) => ({
      ...prev,
      participants: prev.participants.map((p: any, i: number) =>
        i === index ? { ...p, [field]: Number(value) } : p
      ),
    }));
  };

  const handleEditSubmit = async () => {
    setEditError(null);
    if (!editState) return;
    // Validation
    if (editState.splitMethod === 'byAmount') {
      const sum = editState.participants.reduce((acc: number, p: any) => acc + (p.amountOwed || 0), 0);
      if (Math.abs(sum - editState.totalAmount) > 0.01) {
        setEditError('Sum of amounts must equal total amount.');
        return;
      }
    }
    if (editState.splitMethod === 'byPercentage') {
      const sum = editState.participants.reduce((acc: number, p: any) => acc + (p.percentage || 0), 0);
      if (Math.abs(sum - 100) > 0.01) {
        setEditError('Sum of percentages must equal 100%.');
        return;
      }
    }
    setEditLoading(true);
    try {
      await updateSplitExpense(splitId as string, {
        totalAmount: editState.totalAmount,
        payerId: editState.payerId,
        participants: editState.participants,
        splitMethod: editState.splitMethod,
        notes: editState.notes,
      });
      setEditOpen(false);
      await fetchSplit();
      Alert.alert('Success', 'Split updated!');
    } catch (e: any) {
      setEditError(e.message || 'Failed to update split.');
    }
    setEditLoading(false);
  };

  // Only allow edit if current user is payer or admin/creator
  const canEdit = split && group && authUser && (
    split.paidBy === authUser.uid ||
    (group.memberDetails.find((m: any) => m.uid === authUser.uid)?.role === 'admin' ||
     group.memberDetails.find((m: any) => m.uid === authUser.uid)?.role === 'creator')
  );

  if (loading) {
    return <Surface style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><ActivityIndicator animating color={colors.primary} size="large" /><Text>Loading...</Text></Surface>;
  }
  if (error || !split) {
    return <Surface style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><HelperText type="error" visible>{error || 'Split not found.'}</HelperText></Surface>;
  }

  return (
    <Surface style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <Text variant="headlineMedium" style={{ marginBottom: 16 }}>Split Details</Text>
      <Card style={{ marginBottom: 16 }}>
        <Card.Content>
          <Text variant="titleLarge">{split.originalExpenseDescription}</Text>
          <Text>Total: {split.totalAmount} {split.currency}</Text>
          <Text>Split Method: {split.splitMethod}</Text>
          <Text>Paid By: {split.paidBy}</Text>
          <Text>Notes: {split.notes || 'None'}</Text>
        </Card.Content>
      </Card>
      <Text variant="titleLarge" style={{ marginBottom: 8 }}>Participants</Text>
      <List.Section>
        {split.participants.map((p, i) => (
          <List.Item
            key={p.userId}
            title={p.displayName}
            description={`Owes: ${p.amountOwed} ${split.currency} | Status: ${p.settlementStatus}`}
            left={props => <List.Icon {...props} icon={p.settlementStatus === 'settled' ? 'check-circle' : 'account'} />}
            right={props => p.settlementStatus === 'unsettled' ? (
              <Button mode="outlined" loading={settling === p.userId} onPress={() => handleSettle(p.userId)}>
                Settle
              </Button>
            ) : undefined}
          />
        ))}
      </List.Section>
      {canEdit && <Button mode="contained" style={{ marginTop: 16 }} onPress={openEdit}>Edit Split</Button>}
      <Button mode="text" onPress={() => router.back()} style={{ marginTop: 8 }}>Back</Button>
      <Portal>
        <Dialog visible={editOpen} onDismiss={() => setEditOpen(false)}>
          <Dialog.Title>Edit Split</Dialog.Title>
          <Dialog.Content>
            {editState && (
              <>
                <TextInput
                  label="Total Amount"
                  value={String(editState.totalAmount)}
                  onChangeText={v => setEditState((prev: any) => ({ ...prev, totalAmount: Number(v) }))}
                  keyboardType="numeric"
                  style={{ marginBottom: 8 }}
                />
                <RadioButton.Group onValueChange={v => setEditState((prev: any) => ({ ...prev, payerId: v }))} value={editState.payerId}>
                  {group && group.memberDetails.map((m: any) => (
                    <RadioButton.Item key={m.uid} label={`${m.displayName} (${m.email})`} value={m.uid} />
                  ))}
                </RadioButton.Group>
                <RadioButton.Group onValueChange={v => setEditState((prev: any) => ({ ...prev, splitMethod: v }))} value={editState.splitMethod}>
                  {SPLIT_METHODS.map(method => (
                    <RadioButton.Item key={method.value} label={method.label} value={method.value} />
                  ))}
                </RadioButton.Group>
                {editState.participants.map((p: any, i: number) => (
                  <Card key={p.userId} style={{ marginBottom: 8 }}>
                    <Card.Content>
                      <Text>{p.userId}</Text>
                      {editState.splitMethod === 'equally' ? (
                        <Text>Owes: {editState.totalAmount / editState.participants.length}</Text>
                      ) : editState.splitMethod === 'byAmount' ? (
                        <TextInput
                          label="Amount Owed"
                          value={String(p.amountOwed)}
                          onChangeText={v => handleEditChange(i, 'amountOwed', v)}
                          keyboardType="numeric"
                          style={{ marginTop: 8 }}
                        />
                      ) : (
                        <TextInput
                          label="Percentage"
                          value={String(p.percentage)}
                          onChangeText={v => handleEditChange(i, 'percentage', v)}
                          keyboardType="numeric"
                          style={{ marginTop: 8 }}
                        />
                      )}
                    </Card.Content>
                  </Card>
                ))}
                <TextInput
                  label="Notes (optional)"
                  value={editState.notes}
                  onChangeText={v => setEditState((prev: any) => ({ ...prev, notes: v }))}
                  style={{ marginTop: 8, marginBottom: 8 }}
                  multiline
                />
                {editError && <HelperText type="error" visible>{editError}</HelperText>}
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditOpen(false)}>Cancel</Button>
            <Button loading={editLoading} onPress={handleEditSubmit}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Surface>
  );
} 