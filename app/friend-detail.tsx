import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Platform } from 'react-native';
import { Surface, Text, Card, Button, Avatar, ActivityIndicator, useTheme, Snackbar, List, Divider, Chip, IconButton, Portal, Dialog } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { getUserProfile, getSplitExpensesForUser, settleDebtWithWallet, sendDebtReminder } from '../firebase/firestore';
import { format } from 'date-fns';
import { ArrowLeft, Scale, Bell, CheckCircle2 } from 'lucide-react-native';

interface SplitParticipant {
  userId: string;
  displayName: string;
  email: string;
  amountOwed: number;
  settlementStatus: 'settled' | 'unsettled' | 'pending';
}
interface SplitExpense {
  id: string;
  currency: string;
  paidBy: string;
  participants: SplitParticipant[];
  involvedUserIds: string[];
  groupId?: string;
  createdAt: string;
  originalExpenseDescription?: string;
}

export default function FriendDetailScreen() {
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const { authUser, userProfile, loading: authLoading, refetchUserProfile } = useAuth();
  const [friendProfile, setFriendProfile] = useState<any>(null);
  const [allSplits, setAllSplits] = useState<SplitExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingSettlement, setIsProcessingSettlement] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; error?: boolean }>({ visible: false, message: '' });
  const [remindDialog, setRemindDialog] = useState<{ open: boolean; split: SplitExpense | null }>({ open: false, split: null });
  const [remindLoading, setRemindLoading] = useState<'push' | 'email' | 'sms' | null>(null);
  const { colors, dark } = useTheme();
  const router = useRouter();

  const fetchFriendData = useCallback(async () => {
    if (!authUser || !friendId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [friendData, splitsData] = await Promise.all([
        getUserProfile(friendId),
        getSplitExpensesForUser(authUser.uid),
      ]);
      setFriendProfile(friendData);
      setAllSplits(splitsData);
    } catch (error) {
      setSnackbar({ visible: true, message: 'Could not load friend details.', error: true });
    } finally {
      setIsLoading(false);
    }
  }, [authUser, friendId]);

  useEffect(() => {
    if (!authLoading) {
      fetchFriendData();
    }
  }, [authLoading, fetchFriendData]);

  // Filter splits with this friend (not in group)
  const splitsWithFriend = useMemo(() => {
    return allSplits.filter(split => split.involvedUserIds.includes(friendId) && !split.groupId);
  }, [allSplits, friendId]);

  // Net balance, unsettled, settled splits
  const { netBalance, unsettledSplits, settledSplits } = useMemo(() => {
    if (!userProfile) return { netBalance: {}, unsettledSplits: [], settledSplits: [] };
    const balance: Record<string, number> = {};
    const unsettled: SplitExpense[] = [];
    const settled: SplitExpense[] = [];
    splitsWithFriend.forEach(split => {
      const currency = split.currency;
      if (split.paidBy === userProfile.uid) {
        const friendParticipant = split.participants.find(p => p.userId === friendId);
        if (friendParticipant && friendParticipant.settlementStatus !== 'settled') {
          balance[currency] = (balance[currency] || 0) + friendParticipant.amountOwed;
        }
      } else if (split.paidBy === friendId) {
        const myParticipant = split.participants.find(p => p.userId === userProfile.uid);
        if (myParticipant && myParticipant.settlementStatus !== 'settled') {
          balance[currency] = (balance[currency] || 0) - myParticipant.amountOwed;
        }
      }
      const hasAnyUnsettled = split.participants.some(p => p.settlementStatus !== 'settled');
      if (hasAnyUnsettled) {
        unsettled.push(split);
      } else {
        settled.push(split);
      }
    });
    return { netBalance: balance, unsettledSplits: unsettled, settledSplits: settled };
  }, [splitsWithFriend, userProfile, friendId]);

  // Settle up handler
  const handleSettleWithWallet = async (splitId: string) => {
    if (!authUser) return;
    setIsProcessingSettlement(splitId);
    try {
      await settleDebtWithWallet(splitId, authUser.uid);
      setSnackbar({ visible: true, message: 'Settlement Successful!' });
      await refetchUserProfile();
      await fetchFriendData();
    } catch (error: any) {
      setSnackbar({ visible: true, message: error.message || 'Could not complete wallet settlement.', error: true });
    } finally {
      setIsProcessingSettlement(null);
    }
  };

  // Remind handler (open dialog)
  const handleRemind = (split: SplitExpense) => {
    setRemindDialog({ open: true, split });
  };

  // Send actual reminder
  const handleSendReminder = async (type: 'push' | 'email' | 'sms') => {
    if (!userProfile || !friendProfile || !remindDialog.split) return;
    const friendParticipant = remindDialog.split.participants.find(p => p.userId === friendProfile.uid);
    if (!friendParticipant) return;
    setRemindLoading(type);
    try {
      await sendDebtReminder(userProfile, friendProfile.uid, friendParticipant.amountOwed, remindDialog.split.currency, type);
      setSnackbar({ visible: true, message: `A ${type} reminder has been sent to ${friendProfile.displayName}.` });
      setRemindDialog({ open: false, split: null });
    } catch (error: any) {
      setSnackbar({ visible: true, message: error.message || `Could not send ${type} reminder.`, error: true });
    } finally {
      setRemindLoading(null);
    }
  };

  if (isLoading || authLoading) {
    return (
      <Surface style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" />
      </Surface>
    );
  }
  if (!friendProfile) {
    return (
      <Surface style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text variant="headlineMedium">Friend Not Found</Text>
        <Button onPress={() => router.back()} style={{ marginTop: 16 }}>Back to Friends</Button>
      </Surface>
    );
  }

  // Styles
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    card: {
      borderRadius: 16,
      marginBottom: 18,
      backgroundColor: dark ? colors.elevation.level2 : '#fafbfc',
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
      borderWidth: 1,
      borderColor: dark ? colors.outline : '#f0f0f0',
    },
    sectionTitle: {
      fontWeight: '700',
      fontSize: 18,
      marginBottom: 2,
      color: colors.onBackground,
    },
    sectionDesc: {
      color: colors.onSurfaceVariant,
      fontSize: 14,
      marginBottom: 8,
    },
    netBalanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 2,
    },
    netBalanceAmount: {
      fontWeight: 'bold',
      fontSize: 20,
      marginLeft: 8,
    },
    netBalancePositive: {
      color: '#1db954',
    },
    netBalanceNegative: {
      color: colors.error,
    },
    splitCard: {
      borderRadius: 12,
      marginBottom: 12,
      backgroundColor: dark ? colors.elevation.level1 : '#fff',
      borderWidth: 1,
      borderColor: dark ? colors.outline : '#e5e7eb',
      padding: 14,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    splitTitle: {
      fontWeight: '700',
      fontSize: 16,
      marginBottom: 2,
      color: colors.onBackground,
    },
    splitDesc: {
      color: colors.onSurfaceVariant,
      fontSize: 13,
      marginBottom: 2,
    },
    splitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    settledChip: {
      backgroundColor: '#e6f9ed',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 2,
      alignSelf: 'flex-start',
    },
    settledChipText: {
      color: '#1db954',
      fontWeight: 'bold',
      fontSize: 13,
    },
    remindBtn: {
      backgroundColor: dark ? colors.primary : '#f3f4f6',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 4,
      marginLeft: 8,
    },
    remindBtnText: {
      color: dark ? colors.onPrimary : colors.primary,
      fontWeight: 'bold',
      fontSize: 14,
    },
    settleBtn: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 6,
      marginLeft: 8,
    },
    settleBtnText: {
      color: colors.onPrimary,
      fontWeight: 'bold',
      fontSize: 14,
    },
    avatar: {
      backgroundColor: colors.primary,
      marginRight: 16,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 18,
    },
    headerTextCol: {
      flex: 1,
    },
    backBtn: {
      marginRight: 10,
      backgroundColor: dark ? colors.elevation.level1 : '#f3f4f6',
      borderRadius: 100,
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <Surface style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        {/* Header */}
        <View style={styles.headerRow}>
          <IconButton icon={ArrowLeft} size={22} onPress={() => router.back()} style={styles.backBtn} />
          <Avatar.Text size={56} label={friendProfile.displayName ? friendProfile.displayName[0] : '?'} style={styles.avatar} />
          <View style={styles.headerTextCol}>
            <Text style={{ fontWeight: 'bold', fontSize: 20, color: colors.onBackground }}>{friendProfile.displayName}</Text>
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 14 }}>{friendProfile.email}</Text>
          </View>
        </View>
        {/* Net Balance Card */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Scale size={20} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>Net Balance</Text>
            </View>
            <Text style={styles.sectionDesc}>Your overall financial standing with {friendProfile.displayName}.</Text>
            {Object.keys(netBalance).length === 0 ? (
              <Text style={{ color: colors.onSurfaceVariant, fontSize: 15 }}>You and {friendProfile.displayName} are all settled up!</Text>
            ) : (
              Object.entries(netBalance).map(([currency, amount]) => (
                <View key={currency} style={styles.netBalanceRow}>
                  <Text style={[styles.netBalanceAmount, amount >= 0 ? styles.netBalancePositive : styles.netBalanceNegative]}>
                    {amount >= 0 ? '+' : ''}{amount.toFixed(2)} {currency}
                  </Text>
                  <Text style={{ color: colors.onSurfaceVariant, marginLeft: 8, fontSize: 14 }}>
                    {amount >= 0 ? `${friendProfile.displayName} owes you` : `You owe ${friendProfile.displayName}`}
                  </Text>
                </View>
              ))
            )}
          </Card.Content>
        </Card>
        {/* Unsettled Splits */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Unsettled Splits</Text>
            {unsettledSplits.length === 0 ? (
              <Text style={{ color: colors.onSurfaceVariant, fontSize: 15 }}>No unsettled splits.</Text>
            ) : (
              unsettledSplits.map(split => {
                const myParticipant = split.participants.find(p => p.userId === userProfile.uid);
                const friendParticipant = split.participants.find(p => p.userId === friendId);
                const paidByMe = split.paidBy === userProfile.uid;
                const paidByFriend = split.paidBy === friendId;
                return (
                  <View key={split.id} style={styles.splitCard}>
                    <Text style={styles.splitTitle}>{split.originalExpenseDescription || 'Split Expense'}</Text>
                    <Text style={styles.splitDesc}>
                      {paidByMe ? 'You paid' : `${friendProfile.displayName} paid`} for {split.originalExpenseDescription || 'an expense'}
                    </Text>
                    <Text style={styles.splitDesc}>
                      {(() => {
                        let dateObj = null;
                        if (split.createdAt) {
                          if (typeof split.createdAt === 'string' && !isNaN(Date.parse(split.createdAt))) {
                            dateObj = new Date(split.createdAt);
                          } else if (typeof split.createdAt === 'object' && split.createdAt.toDate) {
                            dateObj = split.createdAt.toDate();
                          }
                        }
                        return dateObj ? `Split on ${format(dateObj, 'PPP')}` : 'Split date unknown';
                      })()}
                    </Text>
                    <Text style={styles.splitDesc}>
                      Paid by: {paidByMe ? 'You' : friendProfile.displayName}
                    </Text>
                    <View style={styles.splitRow}>
                      <Text style={{ fontWeight: 'bold', fontSize: 15 }}>
                        Amount: {myParticipant ? myParticipant.amountOwed.toFixed(2) : ''} {split.currency}
                      </Text>
                      {paidByFriend && myParticipant && myParticipant.settlementStatus === 'unsettled' && (
                        <Button
                          mode="contained"
                          style={styles.settleBtn}
                          labelStyle={styles.settleBtnText}
                          loading={isProcessingSettlement === split.id}
                          onPress={() => handleSettleWithWallet(split.id)}
                        >
                          Settle Up
                        </Button>
                      )}
                      {paidByMe && friendParticipant && friendParticipant.settlementStatus === 'unsettled' && (
                        <Button
                          mode="outlined"
                          style={styles.remindBtn}
                          labelStyle={styles.remindBtnText}
                          icon={Bell}
                          onPress={() => handleRemind(split)}
                        >
                          Remind
                        </Button>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </Card.Content>
        </Card>
        {/* Settled History */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Settled History</Text>
            {settledSplits.length === 0 ? (
              <Text style={{ color: colors.onSurfaceVariant, fontSize: 15 }}>No settled splits.</Text>
            ) : (
              settledSplits.map(split => (
                <View key={split.id} style={styles.splitCard}>
                  <Text style={styles.splitTitle}>{split.originalExpenseDescription || 'Split Expense'}</Text>
                  <Text style={styles.splitDesc}>
                    {(() => {
                      let dateObj = null;
                      if (split.createdAt) {
                        if (typeof split.createdAt === 'string' && !isNaN(Date.parse(split.createdAt))) {
                          dateObj = new Date(split.createdAt);
                        } else if (typeof split.createdAt === 'object' && split.createdAt.toDate) {
                          dateObj = split.createdAt.toDate();
                        }
                      }
                      return dateObj ? `Split on ${format(dateObj, 'PPP')}` : 'Split date unknown';
                    })()}
                  </Text>
                  <View style={styles.splitRow}>
                    <Chip icon={CheckCircle2} style={styles.settledChip} textStyle={styles.settledChipText}>Settled</Chip>
                  </View>
                </View>
              ))
            )}
          </Card.Content>
        </Card>
      </ScrollView>
      <Portal>
        <Dialog visible={remindDialog.open} onDismiss={() => setRemindDialog({ open: false, split: null })}>
          <Dialog.Title>Send Reminder</Dialog.Title>
          <Dialog.Content>
            <Text>Select how you want to remind {friendProfile.displayName}:</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => handleSendReminder('push')} loading={remindLoading === 'push'}>Push Notification</Button>
            <Button onPress={() => handleSendReminder('email')} loading={remindLoading === 'email'} disabled={!friendProfile.email}>Email</Button>
            <Button onPress={() => handleSendReminder('sms')} loading={remindLoading === 'sms'} disabled={!friendProfile.phoneNumber}>SMS</Button>
            <Button onPress={() => setRemindDialog({ open: false, split: null })}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ ...snackbar, visible: false })}
        duration={3000}
        style={{ backgroundColor: snackbar.error ? colors.error : colors.primary }}
      >
        {snackbar.message}
      </Snackbar>
    </Surface>
  );
} 