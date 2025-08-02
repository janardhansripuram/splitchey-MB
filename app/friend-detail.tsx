import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bell, CheckCircle2, Scale, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Button, Card, Chip, Dialog, IconButton, Portal, Snackbar, Surface, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSplitExpensesForUser, getUserProfile, removeFriend, sendDebtReminder, settleDebtWithWallet, requestSettlementApproval, approveSettlement, rejectSettlement, getGroupsForUser, getSplitExpensesByGroupId } from '../firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Group, SplitExpense } from '../constants/types';
import SettlementModal from '../components/SettlementModal';
import ApprovalModal from '../components/ApprovalModal';

interface SplitParticipant {
  userId: string;
  displayName: string;
  email: string;
  amountOwed: number;
  settlementStatus: 'settled' | 'unsettled' | 'pending' | 'pending_approval';
}

export default function FriendDetailScreen() {
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const { authUser, userProfile, loading: authLoading, refetchUserProfile } = useAuth();
  const [friendProfile, setFriendProfile] = useState<any>(null);
  const [allSplits, setAllSplits] = useState<SplitExpense[]>([]);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [groupSplits, setGroupSplits] = useState<SplitExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingSettlement, setIsProcessingSettlement] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; error?: boolean }>({ visible: false, message: '' });
  const [remindDialog, setRemindDialog] = useState<{ open: boolean; split: SplitExpense | null }>({ open: false, split: null });
  const [remindLoading, setRemindLoading] = useState<'push' | 'email' | 'sms' | null>(null);
  const [showRemoveFriendDialog, setShowRemoveFriendDialog] = useState(false);
  const [isRemovingFriend, setIsRemovingFriend] = useState(false);

  // Settlement-related state
  const [settlementModal, setSettlementModal] = useState<{ open: boolean; split: SplitExpense | null; participant: SplitParticipant | null }>({ open: false, split: null, participant: null });
  const [approvalModal, setApprovalModal] = useState<{ open: boolean; split: SplitExpense | null; participant: SplitParticipant | null }>({ open: false, split: null, participant: null });
  const { colors, dark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const fetchFriendData = useCallback(async () => {
    if (!authUser || !friendId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // Fetch basic data
      const [friendData, splitsData, groupsData] = await Promise.all([
        getUserProfile(friendId),
        getSplitExpensesForUser(authUser.uid),
        getGroupsForUser(authUser.uid),
      ]);
      
      setFriendProfile(friendData);
      setAllSplits(splitsData);
      setUserGroups(groupsData);

      // Fetch group splits that involve the friend
      const groupsWithFriend = groupsData.filter(group => 
        group.memberIds.includes(friendId)
      );

      if (groupsWithFriend.length > 0) {
        const groupSplitsPromises = groupsWithFriend.map(async (group) => {
          try {
            const splits = await getSplitExpensesByGroupId(group.id);
            // Filter splits that involve the friend
            return splits.filter(split => 
              split.involvedUserIds.includes(friendId) && 
              split.involvedUserIds.includes(authUser.uid)
            );
          } catch (error) {
            console.error(`Failed to fetch splits for group ${group.id}:`, error);
            return [];
          }
        });

        const allGroupSplits = await Promise.all(groupSplitsPromises);
        const flattenedGroupSplits = allGroupSplits.flat();
        setGroupSplits(flattenedGroupSplits);
      } else {
        setGroupSplits([]);
      }
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

  // Filter splits with this friend (personal and group)
  const allSplitsWithFriend = useMemo(() => {
    const personalSplits = allSplits.filter(split => 
      split.involvedUserIds.includes(friendId) && !split.groupId
    );
    const groupSplitsWithFriend = groupSplits.filter(split => 
      split.involvedUserIds.includes(friendId) && split.involvedUserIds.includes(authUser?.uid || '')
    );
    return [...personalSplits, ...groupSplitsWithFriend];
  }, [allSplits, groupSplits, friendId, authUser?.uid]);

  // Net balance, unsettled, settled splits (comprehensive)
  const { netBalance, unsettledSplits, settledSplits, groupSplitsWithFriend } = useMemo(() => {
    if (!userProfile) return { 
      netBalance: {}, 
      unsettledSplits: [], 
      settledSplits: [], 
      groupSplitsWithFriend: [] 
    };
    
    const balance: Record<string, number> = {};
    const unsettled: SplitExpense[] = [];
    const settled: SplitExpense[] = [];
    const groupSplits: SplitExpense[] = [];

    allSplitsWithFriend.forEach(split => {
      const currency = split.currency;
      const isGroupSplit = !!split.groupId;
      
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
        if (isGroupSplit) {
          groupSplits.push(split);
        }
      } else {
        settled.push(split);
      }
    });

    return { netBalance: balance, unsettledSplits: unsettled, settledSplits: settled, groupSplitsWithFriend: groupSplits };
  }, [allSplitsWithFriend, userProfile, friendId]);

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

  const handleRemoveFriend = async () => {
    if (!authUser || !friendId) return;
    setIsRemovingFriend(true);
    try {
      await removeFriend(authUser.uid, friendId);
      setSnackbar({ visible: true, message: `${friendProfile.displayName} has been removed from your friends.` });
      router.replace('/(tabs)/friends'); // Navigate back to friends list
    } catch (error: any) {
      setSnackbar({ visible: true, message: error.message || 'Could not remove friend.', error: true });
    } finally {
      setIsRemovingFriend(false);
      setShowRemoveFriendDialog(false);
    }
  };

  // Settlement handlers
  const handleRequestManualSettlement = async (splitId: string) => {
    if (!userProfile) return;
    setIsProcessingSettlement(splitId);
    try {
      await requestSettlementApproval(splitId, userProfile);
      setSnackbar({ visible: true, message: "Request Sent! The payer has been notified to approve your manual settlement." });
      await fetchFriendData();
    } catch (error: any) {
      console.error("Error requesting manual settlement:", error);
      setSnackbar({ visible: true, message: error.message || "Could not send settlement request.", error: true });
    } finally {
      setIsProcessingSettlement(null);
    }
  };

  const handleApproveSettlement = async (splitId: string, participantId: string) => {
    if (!userProfile) return;
    setIsProcessingSettlement(`${splitId}-${participantId}`);
    try {
      await approveSettlement(splitId, participantId, userProfile);
      setSnackbar({ visible: true, message: "Settlement Approved! The debt has been marked as settled." });
      await fetchFriendData();
    } catch (error: any) {
      console.error("Error approving settlement:", error);
      setSnackbar({ visible: true, message: error.message || "Could not approve the settlement.", error: true });
    } finally {
      setIsProcessingSettlement(null);
    }
  };

  const handleRejectSettlement = async (splitId: string, participantId: string) => {
    if (!userProfile) return;
    setIsProcessingSettlement(`${splitId}-${participantId}`);
    try {
      await rejectSettlement(splitId, participantId, userProfile);
      setSnackbar({ visible: true, message: "Settlement Rejected! The settlement request has been rejected and the debt remains unsettled." });
      await fetchFriendData();
    } catch (error: any) {
      console.error("Error rejecting settlement:", error);
      setSnackbar({ visible: true, message: error.message || "Could not reject the settlement.", error: true });
    } finally {
      setIsProcessingSettlement(null);
    }
  };

  const openSettlementModal = (split: SplitExpense, participant: SplitParticipant) => {
    setSettlementModal({ open: true, split, participant });
  };

  const closeSettlementModal = () => {
    setSettlementModal({ open: false, split: null, participant: null });
  };

  const openApprovalModal = (split: SplitExpense, participant: SplitParticipant) => {
    setApprovalModal({ open: true, split, participant });
  };

  const closeApprovalModal = () => {
    setApprovalModal({ open: false, split: null, participant: null });
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

  // Enhanced styles for modern look
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerWrapper: {
      paddingTop: insets.top + 18,
      paddingBottom: 16,
      paddingHorizontal: 20,
      backgroundColor: colors.background,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    avatar: {
      backgroundColor: colors.primary,
      marginRight: 16,
      elevation: 2,
    },
    friendName: {
      fontWeight: 'bold',
      fontSize: 24,
      color: colors.onBackground,
      marginBottom: 2,
      letterSpacing: -0.2,
    },
    friendEmail: {
      color: colors.onSurfaceVariant,
      fontSize: 15,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backBtn: {
      marginRight: 10,
      backgroundColor: dark ? colors.elevation.level1 : '#f3f4f6',
      borderRadius: 100,
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 0,
    },
    actionIconBtn: {
      backgroundColor: dark ? colors.elevation.level1 : '#f3f4f6',
      borderRadius: 100,
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 0,
      marginLeft: 8,
      marginBottom: 24
    },
    card: {
      borderRadius: 22,
      marginBottom: 22,
      backgroundColor: dark ? colors.elevation.level2 : colors.surface,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
      borderWidth: 1,
      borderColor: dark ? colors.outline : '#f0f0f0',
      overflow: 'hidden',
    },
    sectionTitle: {
      fontWeight: '700',
      fontSize: 20,
      marginBottom: 2,
      color: colors.primary,
      letterSpacing: -0.2,
    },
    sectionDesc: {
      color: colors.onSurfaceVariant,
      fontSize: 15,
      marginBottom: 12,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 20,
      paddingHorizontal: 20,
    },
    netBalanceContainer: {
      marginTop: 12,
      paddingHorizontal: 10,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: dark ? colors.elevation.level1 : '#f9f9f9',
    },
    netBalanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    netBalanceAmount: {
      fontWeight: 'bold',
      fontSize: 20,
    },
    netBalancePositive: {
      color: '#1db954',
    },
    netBalanceNegative: {
      color: colors.error,
    },
    splitCard: {
      borderRadius: 18,
      marginBottom: 16,
      backgroundColor: dark ? colors.elevation.level1 : colors.background,
      borderWidth: 1,
      borderColor: dark ? colors.outline : '#e5e7eb',
      padding: 20,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    splitCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    splitCardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      position: 'absolute',
      top: 10,
      right: 10,
      zIndex: 1,
    },
    splitIconBtn: {
      backgroundColor: dark ? colors.elevation.level2 : '#f0f0f0',
      borderRadius: 100,
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
      elevation: 1,
    },
    splitIconBtnText: {
      fontSize: 12,
      fontWeight: 'bold',
    },
    splitTitle: {
      fontWeight: '700',
      fontSize: 18,
      marginBottom: 4,
      color: colors.onBackground,
    },
    splitDesc: {
      color: colors.onSurfaceVariant,
      fontSize: 14,
      marginBottom: 4,
    },
    splitAmount: {
      fontWeight: 'bold',
      fontSize: 16,
      color: colors.onBackground,
      marginTop: 8,
    },
    splitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    splitActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    settledChip: {
      backgroundColor: '#e6f9ed',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: 'flex-start',
    },
    settledChipText: {
      color: '#1db954',
      fontWeight: 'bold',
      fontSize: 13,
    },
    dialogBtn: {
      borderRadius: 12,
      marginVertical: 4,
      height: 44,
      justifyContent: 'center',
    },
    dialogBtnLabel: {
      fontWeight: 'bold',
      fontSize: 16,
    },
    remindBtn: {
      borderRadius: 20,
      borderColor: colors.outline,
      borderWidth: 1,
      height: 36,
      paddingHorizontal: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    remindBtnText: {
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
  });

  return (
    <Surface style={styles.container}>
      <View style={styles.headerWrapper}>
        <View style={styles.headerContent}>
        
          <Avatar.Text size={56} label={friendProfile.displayName ? friendProfile.displayName[0] : '?'} style={styles.avatar} />
          <View>
            <Text style={styles.friendName}>{friendProfile.displayName}</Text>
            <Text style={styles.friendEmail}>{friendProfile.email}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {/* <IconButton
            icon="trash-can-outline"
            size={24}
            onPress={() => setShowRemoveFriendDialog(true)}
            style={styles.actionIconBtn}
            iconColor={colors.error}
            accessibilityLabel="Remove friend"
          /> */}
            <IconButton
            icon='close'
            size={24}
            onPress={() => router.back()}
            style={styles.actionIconBtn}
           // iconColor={colors.btnPrimary}
            accessibilityLabel="Go back"
          />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 0 }}>
        {/* Net Balance Card */}
        <Card style={styles.card}>
          <Card.Content style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Scale size={22} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Total Net Balance</Text>
            </View>
            <Text style={styles.sectionDesc}>Your overall financial standing with {friendProfile.displayName} (Personal + Group expenses).</Text>
            {Object.keys(netBalance).length === 0 ? (
              <View style={styles.netBalanceContainer}>
                <Text style={{ color: colors.onSurfaceVariant, fontSize: 16, fontWeight: '500', textAlign: 'center' }}>You and {friendProfile.displayName} are all settled up!</Text>
              </View>
            ) : (
              <View style={styles.netBalanceContainer}>
                {Object.entries(netBalance).map(([currency, amount]) => (
                  <View key={currency} style={styles.netBalanceRow}>
                    <Text style={{ color: colors.onSurfaceVariant, fontSize: 15 }}>
                      {amount >= 0 ? `${friendProfile.displayName} owes you` : `You owe ${friendProfile.displayName}`}
                    </Text>
                    <Text style={[styles.netBalanceAmount, amount >= 0 ? styles.netBalancePositive : styles.netBalanceNegative]}>
                      {amount >= 0 ? '+' : ''}{amount.toFixed(2)} {currency}
                    </Text>
                  </View>
                ))}
                {groupSplitsWithFriend.length > 0 && (
                  <View style={{ 
                    marginTop: 12, 
                    paddingTop: 12, 
                    borderTopWidth: 1, 
                    borderTopColor: colors.outline,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}>
                    <Users size={16} color={colors.primary} style={{ marginRight: 6 }} />
                    <Text style={{ color: colors.onSurfaceVariant, fontSize: 13 }}>
                      {groupSplitsWithFriend.length} group expense{groupSplitsWithFriend.length > 1 ? 's' : ''} pending
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Card.Content>
        </Card>
        {/* Unsettled Splits */}
        <Card style={styles.card}>
          <Card.Content style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
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
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.splitTitle}>{split.originalExpenseDescription || 'Split Expense'}</Text>
                        {/* Group Indicator - More Prominent */}
                        {split.groupId && (
                          <View style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            marginTop: 6,
                            backgroundColor: colors.primary + '20',
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 12,
                            alignSelf: 'flex-start',
                            borderWidth: 1,
                            borderColor: colors.primary + '30'
                          }}>
                            <Users size={14} color={colors.primary} style={{ marginRight: 6 }} />
                            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                              {split.groupName || 'Group Expense'}
                            </Text>
                          </View>
                        )}
                      </View>
                      {/* Status Badges - Top Right Corner */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {/* Show Settled only if ALL participants are settled */}
                        {split.participants.every(p => p.settlementStatus === 'settled') && (
                          <View style={{
                            backgroundColor: '#22c55e',
                            borderRadius: 12,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            alignSelf: 'flex-start'
                          }}>
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 10 }}>SETTLED</Text>
                          </View>
                        )}
                        {/* Show Pending only if the current user's participant is pending approval */}
                        {myParticipant?.settlementStatus === 'pending_approval' && (
                          <View style={{
                            backgroundColor: '#f59e0b',
                            borderRadius: 12,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            alignSelf: 'flex-start'
                          }}>
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 10 }}>PENDING</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={styles.splitDesc}>
                      {paidByMe ? 'You paid' : `${friendProfile.displayName} paid`} for {split.originalExpenseDescription || 'an expense'}
                    </Text>
                    <Text style={styles.splitDesc}>
                      {(() => {
                        let dateObj = null;
                        if (split.createdAt && typeof split.createdAt === 'string' && !isNaN(Date.parse(split.createdAt))) {
                          dateObj = new Date(split.createdAt);
                        }
                        return dateObj ? `Split on ${format(dateObj, 'PPP')}` : 'Split date unknown';
                      })()}
                    </Text>
                    <Text style={styles.splitAmount}>
                      Amount: {myParticipant ? myParticipant.amountOwed.toFixed(2) : ''} {split.currency}
                    </Text>
                    <View style={styles.splitRow}>
                      <Text style={{ color: colors.onSurfaceVariant, fontSize: 15 }}>
                        {paidByMe ? 'You are owed' : `${friendProfile.displayName} is owed`}
                      </Text>
                      <View style={styles.splitActions}>
                        {paidByFriend && myParticipant && (
                          myParticipant.settlementStatus === 'unsettled' ? (
                            <Button
                              mode="contained"
                              onPress={() => openSettlementModal(split, myParticipant)}
                              disabled={isProcessingSettlement === split.id}
                              style={{ 
                                borderRadius: 16, 
                                backgroundColor: colors.primary,
                                elevation: 2,
                                alignSelf: 'flex-end'
                              }}
                              contentStyle={{ paddingVertical: 6 }}
                              labelStyle={{ fontSize: 12, fontWeight: '600' }}
                              compact
                            >
                              Settle Up
                            </Button>
                          ) : myParticipant.settlementStatus === 'pending_approval' ? (
                            <View style={{ 
                              backgroundColor: '#f59e0b', 
                              borderRadius: 16, 
                              paddingHorizontal: 12, 
                              paddingVertical: 6,
                              flexDirection: 'row',
                              alignItems: 'center'
                            }}>
                              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Pending</Text>
                            </View>
                          ) : myParticipant.settlementStatus === 'settled' ? (
                            <View style={{ 
                              backgroundColor: '#22c55e', 
                              borderRadius: 16, 
                              paddingHorizontal: 12, 
                              paddingVertical: 6,
                              flexDirection: 'row',
                              alignItems: 'center'
                            }}>
                              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Settled</Text>
                            </View>
                          ) : null
                        )}
                        {paidByMe && friendParticipant && (
                          friendParticipant.settlementStatus === 'unsettled' ? (
                            <Button
                              mode="outlined"
                              style={{ 
                                borderRadius: 16, 
                                borderColor: colors.outline,
                                borderWidth: 1,
                                alignSelf: 'flex-end'
                              }}
                              contentStyle={{ paddingVertical: 6 }}
                              labelStyle={{ fontSize: 12, fontWeight: '600' }}
                              icon={Bell}
                              onPress={() => handleRemind(split)}
                              compact
                            >
                              Remind
                            </Button>
                          ) : friendParticipant.settlementStatus === 'pending_approval' ? (
                            <Button
                              mode="contained"
                              onPress={() => openApprovalModal(split, friendParticipant)}
                              disabled={isProcessingSettlement === `${split.id}-${friendParticipant.userId}`}
                              style={{ 
                                borderRadius: 16,
                                backgroundColor: colors.primary,
                                elevation: 2,
                                alignSelf: 'flex-end'
                              }}
                              contentStyle={{ paddingVertical: 6 }}
                              labelStyle={{ fontSize: 12, fontWeight: '600' }}
                              compact
                            >
                              Review
                            </Button>
                          ) : friendParticipant.settlementStatus === 'settled' ? (
                            <View style={{ 
                              backgroundColor: '#22c55e', 
                              borderRadius: 16, 
                              paddingHorizontal: 12, 
                              paddingVertical: 6,
                              flexDirection: 'row',
                              alignItems: 'center'
                            }}>
                              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Settled</Text>
                            </View>
                          ) : null
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </Card.Content>
        </Card>
        {/* Settled History */}
        <Card style={styles.card}>
          <Card.Content style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
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
                      if (split.createdAt && typeof split.createdAt === 'string' && !isNaN(Date.parse(split.createdAt))) {
                        dateObj = new Date(split.createdAt);
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
        {/* Remind Dialog */}
        <Dialog visible={remindDialog.open} onDismiss={() => setRemindDialog({ open: false, split: null })} style={styles.card}>
          <Dialog.Title style={{ fontWeight: 'bold', fontSize: 22, textAlign: 'center', marginBottom: 4, color: colors.primary }}>Send Reminder</Dialog.Title>
          <Dialog.Content style={{ paddingTop: 10, paddingBottom: 10, paddingHorizontal: 24 }}>
            <Text style={{ fontSize: 16, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 18 }}>
              Select how you want to remind {friendProfile.displayName}:
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{ flexDirection: 'column', alignItems: 'stretch', paddingHorizontal: 24, paddingBottom: 24 }}>
            <Button
              mode="contained"
              onPress={() => handleSendReminder('push')}
              loading={remindLoading === 'push'}
              style={styles.dialogBtn}
              labelStyle={styles.dialogBtnLabel}
              icon={Bell}
            >
              Push Notification
            </Button>
            <Button
              mode="contained"
              onPress={() => handleSendReminder('email')}
              loading={remindLoading === 'email'}
              disabled={!friendProfile.email}
              style={styles.dialogBtn}
              labelStyle={styles.dialogBtnLabel}
              icon="email"
            >
              Email
            </Button>
            <Button
              mode="contained"
              onPress={() => handleSendReminder('sms')}
              loading={remindLoading === 'sms'}
              disabled={!friendProfile.phoneNumber}
              style={styles.dialogBtn}
              labelStyle={styles.dialogBtnLabel}
              icon="message"
            >
              SMS
            </Button>
            <Button
              mode="text"
              onPress={() => setRemindDialog({ open: false, split: null })}
              style={[styles.dialogBtn, { backgroundColor: 'transparent' }]}
              labelStyle={[styles.dialogBtnLabel, { color: colors.onSurfaceVariant }]}
            >
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
        {/* Remove Friend Confirmation Dialog */}
        <Dialog visible={showRemoveFriendDialog} onDismiss={() => setShowRemoveFriendDialog(false)} style={styles.card}>
          <Dialog.Title style={{ fontWeight: 'bold', fontSize: 22, textAlign: 'center', marginBottom: 4, color: colors.error }}>Remove Friend</Dialog.Title>
          <Dialog.Content style={{ paddingTop: 10, paddingBottom: 10, paddingHorizontal: 24 }}>
            <Text style={{ fontSize: 16, textAlign: 'center', color: colors.onSurfaceVariant, marginBottom: 18 }}>
              Are you sure you want to remove {friendProfile.displayName} from your friends? This action cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{ flexDirection: 'column', alignItems: 'stretch', paddingHorizontal: 24, paddingBottom: 24 }}>
            <Button
              mode="contained"
              onPress={handleRemoveFriend}
              loading={isRemovingFriend}
              style={[styles.dialogBtn, { backgroundColor: colors.error }]}
              labelStyle={styles.dialogBtnLabel}
            >
              Remove Friend
            </Button>
            <Button
              mode="text"
              onPress={() => setShowRemoveFriendDialog(false)}
              style={[styles.dialogBtn, { backgroundColor: 'transparent' }]}
              labelStyle={[styles.dialogBtnLabel, { color: colors.onSurfaceVariant }]}
            >
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Settlement Modal */}
        <SettlementModal
          visible={settlementModal.open}
          onDismiss={closeSettlementModal}
          split={settlementModal.split}
          participant={settlementModal.participant}
          isProcessing={isProcessingSettlement === settlementModal.split?.id}
          onSettleWithWallet={handleSettleWithWallet}
          onRequestManualSettlement={handleRequestManualSettlement}
        />

        {/* Approval Modal */}
        <ApprovalModal
          visible={approvalModal.open}
          onDismiss={closeApprovalModal}
          split={approvalModal.split}
          participant={approvalModal.participant}
          isProcessing={isProcessingSettlement}
          onApprove={handleApproveSettlement}
          onReject={handleRejectSettlement}
        />
      </Portal>
      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: '' })}
        duration={3000}
        style={{ backgroundColor: snackbar.error ? colors.error : colors.primary }}
      >
        {snackbar.message}
      </Snackbar>
    </Surface>
  );
}