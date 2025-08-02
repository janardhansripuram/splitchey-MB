import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Dimensions, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Avatar, Button, Card, Chip, Dialog, Divider, IconButton, Menu, Portal, Surface, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFriends, getSplitExpensesForUser, sendDebtReminder, settleDebtWithWallet, requestSettlementApproval, approveSettlement, rejectSettlement } from '../firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { CurrencyCode, Friend, SplitExpense, SplitParticipant, UserProfile } from '../constants/types';
import { getUserProfile } from '../firebase/firestore';

const { width: screenWidth } = Dimensions.get('window');

interface DebtSummary {
  friendId: string;
  friendDisplayName: string;
  friendEmail: string;
  friendPhoneNumber?: string | null;
  friendAvatarText: string;
  netAmount: number;
  currency: CurrencyCode;
  hasPendingRequests: boolean;
  pendingRequests: { split: SplitExpense; participant: SplitParticipant }[];
}

export default function DebtsScreen() {
  const { authUser, userProfile } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [allUserSplits, setAllUserSplits] = useState<SplitExpense[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, UserProfile>>({});
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [remindingFriend, setRemindingFriend] = useState<string | null>(null);
  const [isProcessingSettlement, setIsProcessingSettlement] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Settlement modals
  const [settlementModalVisible, setSettlementModalVisible] = useState(false);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<DebtSummary | null>(null);
  const [selectedPendingRequest, setSelectedPendingRequest] = useState<{ split: SplitExpense; participant: SplitParticipant } | null>(null);

  const fetchAllData = useCallback(async () => {
    if (!authUser) {
      setFriends([]);
      setAllUserSplits([]);
      setFriendProfiles({});
      setIsLoadingPage(false);
      return;
    }
    
    try {
      const [fetchedFriends, allSplits] = await Promise.all([
        getFriends(authUser.uid),
        getSplitExpensesForUser(authUser.uid),
      ]);

      setFriends(fetchedFriends || []);
      setAllUserSplits(allSplits);

      // Fetch friend profiles to get their profile images
      if (fetchedFriends && fetchedFriends.length > 0) {
        const friendProfilePromises = fetchedFriends.map(async (friend) => {
          try {
            const profile = await getUserProfile(friend.uid);
            return { uid: friend.uid, profile };
          } catch (error) {
            console.error(`Failed to fetch profile for friend ${friend.uid}:`, error);
            return { uid: friend.uid, profile: null };
          }
        });

        const friendProfileResults = await Promise.all(friendProfilePromises);
        const profilesMap: Record<string, UserProfile> = {};
        friendProfileResults.forEach(({ uid, profile }) => {
          if (profile) {
            profilesMap[uid] = profile;
          }
        });
        setFriendProfiles(profilesMap);
      }
    } catch (error) {
      console.error("Failed to fetch data for debts page:", error);
      Alert.alert("Error", "Could not load necessary data.");
      setFriends([]);
      setAllUserSplits([]);
      setFriendProfiles({});
    } finally {
      setIsLoadingPage(false);
    }
  }, [authUser]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  }, [fetchAllData]);

  useEffect(() => {
    if (authUser) {
      setIsLoadingPage(true);
      fetchAllData();
    } else {
      setFriends([]);
      setAllUserSplits([]);
      setIsLoadingPage(false);
    }
  }, [authUser, fetchAllData]);

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return '?';
  };

  const debtSummaries = useMemo(() => {
    if (!userProfile || (friends.length === 0 && allUserSplits.length === 0)) {
      return [];
    }
  
    const friendMap = new Map(friends.map(f => [f.uid, f]));
    const netDebts: Record<string, {
      netAmount: Partial<Record<CurrencyCode, number>>,
      pendingRequests: { split: SplitExpense; participant: SplitParticipant }[]
    }> = {};
  
    allUserSplits.forEach(split => {
      const currency = split.currency;
      
      // Case 1: The current user paid for the expense.
      if (split.paidBy === userProfile.uid) {
        split.participants.forEach(p => {
          if (friendMap.has(p.userId)) {
            if (!netDebts[p.userId]) netDebts[p.userId] = { netAmount: {}, pendingRequests: [] };
  
            if (p.settlementStatus !== 'settled') {
              const currentAmount = netDebts[p.userId].netAmount[currency] || 0;
              netDebts[p.userId].netAmount[currency] = currentAmount + p.amountOwed;
            }
  
            if (p.settlementStatus === 'pending_approval') {
              netDebts[p.userId].pendingRequests.push({ split, participant: p });
            }
          }
        });
      } 
      // Case 2: A friend paid. Check if the current user owes them.
      else if (friendMap.has(split.paidBy)) {
        const currentUserParticipant = split.participants.find(p => p.userId === userProfile.uid);
        if (currentUserParticipant && currentUserParticipant.settlementStatus !== 'settled') {
          if (!netDebts[split.paidBy]) netDebts[split.paidBy] = { netAmount: {}, pendingRequests: [] };
          const currentAmount = netDebts[split.paidBy].netAmount[currency] || 0;
          netDebts[split.paidBy].netAmount[currency] = currentAmount - currentUserParticipant.amountOwed;
        }
      }
    });
    
    const summaries: DebtSummary[] = [];
    Object.entries(netDebts).forEach(([friendId, data]) => {
      const friend = friendMap.get(friendId);
      if (!friend) return;
  
      const hasPending = data.pendingRequests.length > 0;
  
      Object.entries(data.netAmount).forEach(([currency, amount]) => {
        if (Math.abs(amount) < 0.01) return;
        summaries.push({
          friendId,
          friendDisplayName: friend.displayName || friend.email || 'Unknown',
          friendEmail: friend.email || '',
          friendPhoneNumber: friend.phoneNumber || null,
          friendAvatarText: getInitials(friend.displayName, friend.email),
          netAmount: amount,
          currency: currency as CurrencyCode,
          hasPendingRequests: hasPending,
          pendingRequests: data.pendingRequests,
        });
      });
    });
      
    return summaries.sort((a,b) => a.currency.localeCompare(b.currency) || Math.abs(b.netAmount) - Math.abs(a.netAmount));
  }, [userProfile, friends, allUserSplits]);

  const hasMixedCurrenciesInDebts = useMemo(() => {
    if (debtSummaries.length <= 1) return false;
    const currencies = new Set(debtSummaries.map(d => d.currency));
    return currencies.size > 1;
  }, [debtSummaries]);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency, 
      signDisplay: 'auto' 
    }).format(amount);
  };

  const handleSendReminder = async (friendId: string, displayName: string, amount: number, currency: CurrencyCode, type: 'push' | 'email' | 'sms') => {
    if (!userProfile) return;
    const reminderKey = `${friendId}-${currency}-${type}`;
    setRemindingFriend(reminderKey);
    try {
      await sendDebtReminder(userProfile, friendId, Math.abs(amount), currency, type);
      Alert.alert("Reminder Sent!", `A ${type} reminder has been sent to ${displayName}.`);
    } catch (error: any) {
      Alert.alert("Error", error.message || `Could not send ${type} reminder.`);
    } finally {
      setRemindingFriend(null);
    }
  };

  const handleSettleWithWallet = async (summary: DebtSummary) => {
    if (!authUser || !userProfile) return;
    setIsProcessingSettlement(summary.friendId);
    try {
      const splitsToSettle = allUserSplits.filter(s => 
        s.participants.some(p => p.userId === authUser.uid && p.settlementStatus === 'unsettled') &&
        s.currency === summary.currency
      );
      for (const split of splitsToSettle) {
        await settleDebtWithWallet(split.id!, authUser.uid);
      }
      Alert.alert("Success", `Settled all debts with ${summary.friendDisplayName} using your wallet.`);
      await fetchAllData();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not settle debt with wallet.");
    } finally {
      setIsProcessingSettlement(null);
      setSettlementModalVisible(false);
    }
  };

  const handleRequestManualSettlement = async (summary: DebtSummary) => {
    if (!authUser) return;
    setIsProcessingSettlement(summary.friendId);
    try {
      const splitsToSettle = allUserSplits.filter(s => 
        s.participants.some(p => p.userId === authUser.uid && p.settlementStatus === 'unsettled') &&
        s.currency === summary.currency
      );
      for (const split of splitsToSettle) {
        await requestSettlementApproval(split.id!, userProfile!);
      }
      Alert.alert("Request Sent", `A settlement request has been sent to ${summary.friendDisplayName}.`);
      await fetchAllData();
    } catch (error: any) {
      Alert.alert("Request Failed", error.message || "Could not send settlement request.");
    } finally {
      setIsProcessingSettlement(null);
      setSettlementModalVisible(false);
    }
  };

  const handleApproveSettlement = async (splitId: string, participantId: string) => {
    if (!userProfile) return;
    setIsProcessingSettlement(`${splitId}-${participantId}`);
    try {
      await approveSettlement(splitId, participantId, userProfile);
      Alert.alert("Settlement Approved", "The debt has been marked as settled.");
      await fetchAllData();
    } catch (error: any) {
      console.error("Error approving settlement:", error);
      Alert.alert("Approval Failed", error.message || "Could not approve the settlement.");
    } finally {
      setIsProcessingSettlement(null);
      setApprovalModalVisible(false);
    }
  };

  const handleRejectSettlement = async (splitId: string, participantId: string) => {
    if (!userProfile) return;
    setIsProcessingSettlement(`${splitId}-${participantId}`);
    try {
      await rejectSettlement(splitId, participantId, userProfile);
      Alert.alert("Settlement Rejected", "The settlement request has been rejected and the debt remains unsettled.");
      await fetchAllData();
    } catch (error: any) {
      console.error("Error rejecting settlement:", error);
      Alert.alert("Action Failed", error.message || "Could not reject the settlement.");
    } finally {
      setIsProcessingSettlement(null);
      setApprovalModalVisible(false);
    }
  };

  const openSettlementModal = (summary: DebtSummary) => {
    setSelectedSummary(summary);
    setSettlementModalVisible(true);
  };

  const openApprovalModal = (request: { split: SplitExpense; participant: SplitParticipant }) => {
    setSelectedPendingRequest(request);
    setApprovalModalVisible(true);
  };

  if (isLoadingPage) {
    return (
      <Surface style={{ flex: 1, backgroundColor: colors.background }}>
        <LinearGradient
          colors={[colors.primary, colors.primary + '80']}
          style={{ height: 200, paddingTop: insets.top + 20, paddingHorizontal: 20 }}
        >
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator animating color="#fff" size="large" />
            <Text style={{ marginTop: 16, color: '#fff', fontSize: 16, fontWeight: '600' }}>
              Calculating debts...
            </Text>
          </View>
        </LinearGradient>
      </Surface>
    );
  }

  return (
    <Surface style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header with Gradient */}
      <LinearGradient
        colors={[colors.primary, colors.primary + '80']}
        style={{ paddingTop: insets.top + 20, paddingBottom: 30, paddingHorizontal: 20 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }}>Debts</Text>
            <Text style={{ color: '#fff', opacity: 0.9, fontSize: 16, marginTop: 4 }}>
              Track who owes whom
            </Text>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={[styles.summaryCard, { backgroundColor: '#22c55e' }]}>
            <MaterialCommunityIcons name="arrow-up" size={24} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 8 }}>
              {debtSummaries.filter(d => d.netAmount > 0).length}
            </Text>
            <Text style={{ color: '#fff', opacity: 0.9, fontSize: 12 }}>You're Owed</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#ef4444' }]}>
            <MaterialCommunityIcons name="arrow-down" size={24} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 8 }}>
              {debtSummaries.filter(d => d.netAmount < 0).length}
            </Text>
            <Text style={{ color: '#fff', opacity: 0.9, fontSize: 12 }}>You Owe</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#f59e0b' }]}>
            <MaterialCommunityIcons name="clock-outline" size={24} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 8 }}>
              {debtSummaries.filter(d => d.hasPendingRequests).length}
            </Text>
            <Text style={{ color: '#fff', opacity: 0.9, fontSize: 12 }}>Pending</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Mixed Currencies Alert */}
        {hasMixedCurrenciesInDebts && (
          <View style={[styles.alertCard, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="alert-circle" size={20} color="#f59e0b" />
              <Text style={{ marginLeft: 8, fontWeight: 'bold', color: '#92400e', fontSize: 16 }}>
                Multiple Currencies
              </Text>
            </View>
            <Text style={{ color: '#92400e', fontSize: 14, lineHeight: 20 }}>
              Debts involve multiple currencies. Each line item represents a debt in a specific currency. No automatic currency conversion is applied.
            </Text>
          </View>
        )}

        {/* Debt Summaries */}
        {debtSummaries.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primary + '20' }]}>
              <MaterialCommunityIcons name="account-group" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
              All clear! No outstanding debts
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
              Or, you haven't split any expenses yet
            </Text>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {debtSummaries.map((summary, index) => (
              <TouchableOpacity
                key={`${summary.friendId}-${summary.currency}`}
                style={[styles.debtCard, { backgroundColor: colors.elevation.level1 }]}
                activeOpacity={0.8}
              >
                {/* Main Content */}
                <View style={styles.debtCardContent}>
                  {/* Three Column Layout: Friend | Amount/Direction | Current User */}
                  <View style={styles.threeColumnLayout}>
                    {/* Left: Friend Info */}
                    <TouchableOpacity 
                      style={styles.friendSection}
                      onPress={() => router.push(`/friend-detail?friendId=${summary.friendId}`)}
                      activeOpacity={0.7}
                    >
                      {friendProfiles[summary.friendId]?.photoURL ? (
                        <Avatar.Image 
                          size={40} 
                          source={{ uri: friendProfiles[summary.friendId].photoURL! }}
                          style={{ marginRight: 8 }}
                        />
                      ) : (
                        <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
                          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                            {summary.friendAvatarText}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={[styles.friendName, { color: colors.onSurface }]}>
                          {summary.friendDisplayName}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Middle: Amount and Direction */}
                    <View style={styles.amountSection}>
                      <MaterialCommunityIcons 
                        name={summary.netAmount > 0 ? "arrow-right" : "arrow-left"} 
                        size={20} 
                        color={summary.netAmount > 0 ? '#22c55e' : '#ef4444'} 
                      />
                      <View style={[
                        styles.amountBadge,
                        { 
                          backgroundColor: summary.netAmount > 0 ? '#22c55e' : '#ef4444',
                        }
                      ]}>
                        <Text style={styles.amountBadgeText}>
                          {formatCurrency(Math.abs(summary.netAmount), summary.currency)}
                        </Text>
                      </View>
                      <Text style={[styles.directionText, { color: colors.onSurfaceVariant }]}>
                        {summary.netAmount > 0 ? 'Owes You' : 'You Owe'}
                      </Text>
                    </View>

                    {/* Right: Current User Info */}
                    <View style={styles.userSection}>
                      <View style={{ flex: 1, alignItems: 'flex-end', marginRight: 8 }}>
                        <Text style={[styles.userName, { color: colors.onSurface }]}>
                          {userProfile?.displayName || 'You'}
                        </Text>
                      </View>
                      {userProfile?.photoURL ? (
                        <Avatar.Image 
                          size={40} 
                          source={{ uri: userProfile.photoURL }}
                        />
                      ) : (
                        <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
                          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                            {getInitials(userProfile?.displayName, userProfile?.email)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                {summary.netAmount < 0 && (
                  <View style={[styles.actionSection, { borderTopColor: colors.outline }]}>
                    <Button
                      mode="contained"
                      onPress={() => openSettlementModal(summary)}
                      disabled={isProcessingSettlement === summary.friendId}
                      loading={isProcessingSettlement === summary.friendId}
                      style={[styles.actionButton, { backgroundColor: colors.primary }]}
                      contentStyle={styles.actionButtonContent}
                      labelStyle={styles.actionButtonLabel}
                      icon="wallet"
                    >
                      Settle with {summary.friendDisplayName}
                    </Button>
                  </View>
                )}

                {summary.netAmount > 0 && (
                  <View style={[styles.actionSection, { borderTopColor: colors.outline }]}>
                    <View style={styles.actionButtonsRow}>
                      {summary.hasPendingRequests && (
                        <Button
                          mode="outlined"
                          onPress={() => {
                            if (summary.pendingRequests.length > 0) {
                              openApprovalModal(summary.pendingRequests[0]);
                            }
                          }}
                          style={[styles.actionButton, { borderColor: '#f59e0b' }]}
                          contentStyle={styles.actionButtonContent}
                          labelStyle={[styles.actionButtonLabel, { color: '#f59e0b' }]}
                          icon="mail-question"
                        >
                          Review ({summary.pendingRequests.length})
                        </Button>
                      )}

                      <Button
                        mode="outlined"
                        onPress={() => {
                          setSelectedSummary(summary);
                          setReminderModalVisible(true);
                        }}
                        style={[styles.actionButton, { borderColor: colors.outline }]}
                        contentStyle={styles.actionButtonContent}
                        labelStyle={[styles.actionButtonLabel, { color: colors.onSurface }]}
                        icon="bell-ring"
                        compact
                      >
                        Remind
                      </Button>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Settlement Modal */}
      <Portal>
        <Dialog visible={settlementModalVisible} onDismiss={() => setSettlementModalVisible(false)}>
          <Dialog.Title style={styles.modalTitle}>
            Settle your debt
          </Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.modalDescription, { color: colors.onSurfaceVariant }]}>
              Choose how you want to settle your debts with {selectedSummary?.friendDisplayName}. This will apply to all your unsettled expenses with them in this currency.
            </Text>
            <View style={styles.modalActions}>
              <Button
                mode="contained"
                onPress={() => selectedSummary && handleSettleWithWallet(selectedSummary)}
                disabled={isProcessingSettlement === selectedSummary?.friendId}
                loading={isProcessingSettlement === selectedSummary?.friendId}
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                contentStyle={styles.modalButtonContent}
                labelStyle={styles.modalButtonLabel}
                icon="wallet"
              >
                Pay with Wallet
              </Button>
              <Button
                mode="outlined"
                onPress={() => selectedSummary && handleRequestManualSettlement(selectedSummary)}
                disabled={isProcessingSettlement === selectedSummary?.friendId}
                style={[styles.modalButton, { borderColor: colors.outline }]}
                contentStyle={styles.modalButtonContent}
                labelStyle={[styles.modalButtonLabel, { color: colors.onSurface }]}
                icon="handshake"
              >
                I Paid Manually
              </Button>
            </View>
          </Dialog.Content>
        </Dialog>
      </Portal>

      {/* Approval Modal */}
      <Portal>
        <Dialog visible={approvalModalVisible} onDismiss={() => setApprovalModalVisible(false)}>
          <Dialog.Title style={styles.modalTitle}>
            Review Manual Settlement
          </Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.modalDescription, { color: colors.onSurfaceVariant }]}>
              Your friend has requested approval for a manual payment.
            </Text>
            <View style={[styles.paymentCard, { backgroundColor: colors.elevation.level1 }]}>
              <Text style={[styles.paymentAmount, { color: colors.onSurface }]}>
                {formatCurrency(selectedPendingRequest?.participant.amountOwed || 0, selectedPendingRequest?.split.currency || 'USD')}
              </Text>
              <Text style={[styles.paymentDescription, { color: colors.onSurfaceVariant }]}>
                {selectedPendingRequest?.split.originalExpenseDescription}
              </Text>
            </View>
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => {
                  if (selectedPendingRequest) {
                    handleRejectSettlement(selectedPendingRequest.split.id!, selectedPendingRequest.participant.userId);
                  }
                }}
                disabled={!!isProcessingSettlement}
                style={[styles.modalButton, { borderColor: '#ef4444' }]}
                contentStyle={styles.modalButtonContent}
                labelStyle={[styles.modalButtonLabel, { color: '#ef4444' }]}
                icon="close"
              >
                Reject
              </Button>
              <Button
                mode="contained"
                onPress={() => {
                  if (selectedPendingRequest) {
                    handleApproveSettlement(selectedPendingRequest.split.id!, selectedPendingRequest.participant.userId);
                  }
                }}
                disabled={!!isProcessingSettlement}
                style={[styles.modalButton, { backgroundColor: '#22c55e' }]}
                contentStyle={styles.modalButtonContent}
                labelStyle={styles.modalButtonLabel}
                icon="check"
              >
                Approve
              </Button>
            </View>
          </Dialog.Content>
        </Dialog>
      </Portal>

      {/* Reminder Modal */}
      <Portal>
        <Dialog visible={reminderModalVisible} onDismiss={() => setReminderModalVisible(false)}>
          <Dialog.Title style={styles.modalTitle}>
            Send Reminder
          </Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.modalDescription, { color: colors.onSurfaceVariant }]}>
              Choose how you'd like to remind {selectedSummary?.friendDisplayName} about the outstanding debt of {selectedSummary && formatCurrency(Math.abs(selectedSummary.netAmount), selectedSummary.currency)}.
            </Text>
            <View style={styles.reminderOptions}>
              <TouchableOpacity
                style={[styles.reminderOption, { backgroundColor: colors.elevation.level1 }]}
                onPress={() => {
                  if (selectedSummary) {
                    handleSendReminder(selectedSummary.friendId, selectedSummary.friendDisplayName, selectedSummary.netAmount, selectedSummary.currency, 'push');
                  }
                  setReminderModalVisible(false);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.reminderIcon, { backgroundColor: colors.primary }]}>
                  <MaterialCommunityIcons name="bell-ring" size={24} color="#fff" />
                </View>
                <View style={styles.reminderText}>
                  <Text style={[styles.reminderTitle, { color: colors.onSurface }]}>
                    Push Notification
                  </Text>
                  <Text style={[styles.reminderSubtitle, { color: colors.onSurfaceVariant }]}>
                    Send an in-app notification
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reminderOption, { backgroundColor: colors.elevation.level1 }]}
                onPress={() => {
                  if (selectedSummary) {
                    handleSendReminder(selectedSummary.friendId, selectedSummary.friendDisplayName, selectedSummary.netAmount, selectedSummary.currency, 'email');
                  }
                  setReminderModalVisible(false);
                }}
                activeOpacity={0.7}
                disabled={!selectedSummary?.friendEmail}
              >
                <View style={[styles.reminderIcon, { backgroundColor: selectedSummary?.friendEmail ? colors.primary : colors.onSurfaceVariant }]}>
                  <MaterialCommunityIcons name="email" size={24} color="#fff" />
                </View>
                <View style={styles.reminderText}>
                  <Text style={[styles.reminderTitle, { color: colors.onSurface }]}>
                    Email Reminder
                  </Text>
                  <Text style={[styles.reminderSubtitle, { color: colors.onSurfaceVariant }]}>
                    Send an email notification
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reminderOption, { backgroundColor: colors.elevation.level1 }]}
                onPress={() => {
                  if (selectedSummary) {
                    handleSendReminder(selectedSummary.friendId, selectedSummary.friendDisplayName, selectedSummary.netAmount, selectedSummary.currency, 'sms');
                  }
                  setReminderModalVisible(false);
                }}
                activeOpacity={0.7}
                disabled={!selectedSummary?.friendPhoneNumber}
              >
                <View style={[styles.reminderIcon, { backgroundColor: selectedSummary?.friendPhoneNumber ? colors.primary : colors.onSurfaceVariant }]}>
                  <MaterialCommunityIcons name="message-text" size={24} color="#fff" />
                </View>
                <View style={styles.reminderText}>
                  <Text style={[styles.reminderTitle, { color: colors.onSurface }]}>
                    SMS Reminder
                  </Text>
                  <Text style={[styles.reminderSubtitle, { color: colors.onSurfaceVariant }]}>
                    Send a text message
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
          </Dialog.Content>
        </Dialog>
      </Portal>
    </Surface>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  alertCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  debtCard: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  debtCardContent: {
    padding: 16,
  },
  threeColumnLayout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  friendSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  amountSection: {
    alignItems: 'center',
    flex: 1,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  amountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginVertical: 4,
  },
  amountBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusSection: {
    alignItems: 'center',
  },
  directionText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  actionSection: {
    borderTopWidth: 1,
    padding: 16,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    borderRadius: 12,
    flex: 1,
  },
  actionButtonContent: {
    paddingVertical: 6,
  },
  actionButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  modalActions: {
    gap: 12,
  },
  modalButton: {
    borderRadius: 12,
  },
  modalButtonContent: {
    paddingVertical: 12,
  },
  modalButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  paymentCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  paymentAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  paymentDescription: {
    fontSize: 16,
    textAlign: 'center',
  },
  reminderOptions: {
    gap: 12,
  },
  reminderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reminderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  reminderText: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  reminderSubtitle: {
    fontSize: 14,
  },
}); 