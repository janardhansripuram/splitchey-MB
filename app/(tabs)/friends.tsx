import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Surface, Text, Card, Button, Avatar, ActivityIndicator, useTheme, Snackbar, IconButton, Portal, Dialog, TextInput } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { getFriends, getIncomingFriendRequests, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, getSplitExpensesForUser, removeFriend, getUserProfile } from '../../firebase/firestore';
import { useRouter } from 'expo-router';
import { UserPlus, Inbox } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function FriendsScreen() {
  const { authUser, userProfile, loading: authLoading } = useAuth();
  const [friends, setFriends] = useState<any[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [allUserSplits, setAllUserSplits] = useState<any[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isProcessingRequest, setIsProcessingRequest] = useState<string | null>(null);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [inviteType, setInviteType] = useState<'email' | 'phone'>('email');
  const [identifier, setIdentifier] = useState('');
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; error?: boolean }>({ visible: false, message: '' });
  const { colors, dark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const fetchInitialData = useCallback(async () => {
    if (!authUser || !authUser.uid) {
      setFriends([]);
      setIncomingRequests([]);
      setAllUserSplits([]);
      setIsLoadingFriends(false);
      setIsLoadingRequests(false);
      return;
    }
    setIsLoadingFriends(true);
    setIsLoadingRequests(true);
    try {
      const [userFriendsData, userRequestsData, userSplitsData] = await Promise.all([
        getFriends(authUser.uid),
        getIncomingFriendRequests(authUser.uid),
        getSplitExpensesForUser(authUser.uid),
      ]);
      setFriends(userFriendsData);
      setIncomingRequests(userRequestsData);
      setAllUserSplits(userSplitsData);
    } catch (error) {
      setSnackbar({ visible: true, message: 'Could not load friends data.', error: true });
    } finally {
      setIsLoadingFriends(false);
      setIsLoadingRequests(false);
    }
  }, [authUser]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchInitialData();
    setRefreshing(false);
  }, [fetchInitialData]);

  useEffect(() => {
    if (!authLoading && authUser) {
      fetchInitialData();
    }
  }, [authLoading, authUser, fetchInitialData]);

  // Net balance calculation (same as web)
  const friendBalances = useMemo(() => {
    const balances: Record<string, Record<string, number>> = {};
    if (!userProfile) return balances;
    allUserSplits.forEach((split: any) => {
      const currency = split.currency;
      if (split.paidBy === userProfile.uid) {
        split.participants.forEach((p: any) => {
          if (friends.some((f: any) => f.uid === p.userId) && p.settlementStatus !== 'settled') {
            if (!balances[p.userId]) balances[p.userId] = {};
            balances[p.userId][currency] = (balances[p.userId][currency] || 0) + p.amountOwed;
          }
        });
      } else {
        const myParticipant = split.participants.find((p: any) => p.userId === userProfile.uid);
        if (myParticipant && myParticipant.settlementStatus !== 'settled' && friends.some((f: any) => f.uid === split.paidBy)) {
          if (!balances[split.paidBy]) balances[split.paidBy] = {};
          balances[split.paidBy][currency] = (balances[split.paidBy][currency] || 0) - myParticipant.amountOwed;
        }
      }
    });
    return balances;
  }, [allUserSplits, friends, userProfile]);

  // Add Friend
  const handleSendFriendRequest = async () => {
    if (!authUser || !identifier.trim()) {
      setSnackbar({ visible: true, message: 'User profile not loaded or input is empty.', error: true });
      return;
    }
    setIsSendingRequest(true);
    try {
      const result = await sendFriendRequest(authUser.uid, userProfile?.email, userProfile?.displayName, identifier, inviteType);
      if (result.success) {
        setSnackbar({ visible: true, message: 'Friend Request Sent!' });
        setIdentifier('');
        setShowAddFriend(false);
        fetchInitialData();
      } else {
        setSnackbar({ visible: true, message: result.message, error: true });
      }
    } catch (error: any) {
      setSnackbar({ visible: true, message: error.message || 'Could not send friend request.', error: true });
    } finally {
      setIsSendingRequest(false);
    }
  };

  // Accept/Reject/Remove
  const handleAcceptRequest = async (request: any) => {
    if (!authUser) return;
    setIsProcessingRequest(request.id);
    try {
      const fromUserProfile = await getUserProfile(request.fromUserId);
      await acceptFriendRequest(request.id, fromUserProfile, userProfile);
      setSnackbar({ visible: true, message: `You are now friends with ${request.fromUserDisplayName || request.fromUserEmail}.` });
      fetchInitialData();
    } catch (error: any) {
      setSnackbar({ visible: true, message: error.message || 'Could not accept friend request.', error: true });
    } finally {
      setIsProcessingRequest(null);
    }
  };
  const handleRejectRequest = async (requestId: string) => {
    setIsProcessingRequest(requestId);
    try {
      await rejectFriendRequest(requestId);
      setSnackbar({ visible: true, message: 'Request Rejected' });
      fetchInitialData();
    } catch (error: any) {
      setSnackbar({ visible: true, message: error.message || 'Could not reject friend request.', error: true });
    } finally {
      setIsProcessingRequest(null);
    }
  };

  // UI styles
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      marginTop: 24,
      marginBottom: 8,
      paddingHorizontal: 20,
    },
    title: {
      fontWeight: 'bold',
      fontSize: 28,
      color: colors.onBackground,
      marginBottom: 2,
    },
    subtitle: {
      color: colors.onSurfaceVariant,
      fontSize: 15,
      marginBottom: 18,
    },
    addBtn: {
      borderRadius: 8,
      backgroundColor: colors.primary,
      marginBottom: 24,
      alignSelf: 'flex-start',
      paddingHorizontal: 18,
      paddingVertical: 8,
    },
    addBtnLabel: {
      fontWeight: 'bold',
      fontSize: 16,
      color: colors.onPrimary,
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
      padding: 0,
    },
    cardTitle: {
      fontWeight: 'bold',
      fontSize: 20,
      color: colors.onBackground,
      marginBottom: 2,
      marginTop: 10,
      marginLeft: 18,
    },
    cardSubtitle: {
      color: colors.onSurfaceVariant,
      fontSize: 14,
      marginBottom: 10,
      marginLeft: 18,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
    },
    friendCard: {
      borderRadius: 14,
      backgroundColor: dark ? colors.elevation.level1 : '#fff',
      borderWidth: 1,
      borderColor: dark ? colors.outline : '#e5e7eb',
      marginHorizontal: 14,
      marginBottom: 14,
      padding: 18,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    friendInfo: {
      flex: 1,
      marginLeft: 16,
    },
    friendName: {
      fontWeight: 'bold',
      fontSize: 17,
      color: colors.onBackground,
    },
    friendEmail: {
      color: colors.onSurfaceVariant,
      fontSize: 14,
      marginBottom: 2,
    },
    balanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    balancePositive: {
      color: '#1db954',
      fontWeight: 'bold',
      fontSize: 15,
    },
    balanceNegative: {
      color: colors.error,
      fontWeight: 'bold',
      fontSize: 15,
    },
    balanceIcon: {
      marginRight: 4,
    },
  });

  return (
    <Surface style={[styles.container, { paddingTop: insets.top }] }>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Friends</Text>
          <Text style={styles.subtitle}>Manage your connections for easy expense splitting and sharing.</Text>
          <Button
            mode="contained"
            icon={UserPlus}
            style={styles.addBtn}
            labelStyle={styles.addBtnLabel}
            onPress={() => setShowAddFriend(true)}
          >
            Add New Friend
          </Button>
        </View>
        {/* Incoming Friend Requests */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Incoming Friend Requests</Text>
          <Text style={styles.cardSubtitle}>Respond to users who want to connect with you.</Text>
          {isLoadingRequests ? (
            <ActivityIndicator style={{ marginVertical: 24 }} />
          ) : incomingRequests.length === 0 ? (
            <View style={styles.emptyState}>
              <Inbox size={48} color={colors.onSurfaceVariant} style={{ marginBottom: 10 }} />
              <Text style={{ color: colors.onSurfaceVariant, fontSize: 16, fontWeight: '600', marginBottom: 2 }}>No incoming friend requests.</Text>
              <Text style={{ color: colors.onSurfaceVariant, fontSize: 14, textAlign: 'center' }}>
                When someone sends you a request, it will appear here.
              </Text>
            </View>
          ) : (
            incomingRequests.map((request: any) => (
              <View key={request.id} style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 18, marginBottom: 12 }}>
                <Avatar.Text size={44} label={request.fromUserDisplayName ? request.fromUserDisplayName[0] : '?'} style={{ backgroundColor: colors.primary, marginRight: 14 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, color: colors.onBackground }}>{request.fromUserDisplayName || request.fromUserEmail}</Text>
                  <Text style={{ color: colors.onSurfaceVariant, fontSize: 13 }}>{request.fromUserEmail}</Text>
                </View>
                <Button
                  mode="contained"
                  style={{ marginRight: 8, borderRadius: 8 }}
                  loading={isProcessingRequest === request.id}
                  onPress={() => handleAcceptRequest(request)}
                >
                  Accept
                </Button>
                <Button
                  mode="outlined"
                  style={{ borderRadius: 8 }}
                  loading={isProcessingRequest === request.id}
                  onPress={() => handleRejectRequest(request.id)}
                  textColor={colors.error}
                >
                  Reject
                </Button>
              </View>
            ))
          )}
        </Card>
        {/* Your Friends */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Your Friends</Text>
          <Text style={styles.cardSubtitle}>List of your current connections.</Text>
          {isLoadingFriends ? (
            <ActivityIndicator style={{ marginVertical: 24 }} />
          ) : friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ color: colors.onSurfaceVariant, fontSize: 16, fontWeight: '600', marginBottom: 2 }}>No friends found.</Text>
              <Text style={{ color: colors.onSurfaceVariant, fontSize: 14, textAlign: 'center' }}>
                When you add friends, they will appear here.
              </Text>
            </View>
          ) : (
            friends.map((friend: any) => (
              <Button
                key={friend.uid}
                style={styles.friendCard}
                mode="text"
                onPress={() => router.push({ pathname: '/friend-detail', params: { friendId: friend.uid } })}
                contentStyle={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}
              >
                <Avatar.Text size={48} label={friend.displayName ? friend.displayName[0] : '?'} style={{ backgroundColor: colors.primary }} />
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{friend.displayName || friend.email}</Text>
                  <Text style={styles.friendEmail}>{friend.email}</Text>
                  <View style={styles.balanceRow}>
                    {friendBalances[friend.uid] && Object.entries(friendBalances[friend.uid]).map(([currency, amount]) => (
                      <Text
                        key={currency}
                        style={amount >= 0 ? styles.balancePositive : styles.balanceNegative}
                      >
                        {amount >= 0 ? '↗ Owes you ' : '↘ You owe '}
                        {currency} {Math.abs(amount).toFixed(2)}
                      </Text>
                    ))}
                  </View>
                </View>
                <IconButton icon="chevron-right" size={28} />
              </Button>
            ))
          )}
        </Card>
        {/* Add Friend Dialog */}
        <Portal>
          <Dialog visible={showAddFriend} onDismiss={() => setShowAddFriend(false)} style={{ borderRadius: 20, overflow: 'hidden' }}>
            <Dialog.Content style={{ paddingTop: 28, paddingBottom: 16 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 22, textAlign: 'center', marginBottom: 4, color: colors.onBackground }}>Add New Friend</Text>
              <Text style={{ color: colors.onSurfaceVariant, fontSize: 15, textAlign: 'center', marginBottom: 18 }}>Invite by email or phone to start splitting expenses.</Text>
              {/* Pill-style tab switcher */}
              <View style={{ flexDirection: 'row', alignSelf: 'center', marginBottom: 18, backgroundColor: dark ? colors.elevation.level1 : '#f3f4f6', borderRadius: 24, padding: 4 }}>
                <Button
                  mode={inviteType === 'email' ? 'contained' : 'text'}
                  onPress={() => setInviteType('email')}
                  style={{ borderRadius: 20, marginRight: 4, backgroundColor: inviteType === 'email' ? colors.primary : 'transparent', minWidth: 100 }}
                  labelStyle={{ color: inviteType === 'email' ? colors.onPrimary : colors.onSurfaceVariant, fontWeight: 'bold' }}
                >
                  By Email
                </Button>
                <Button
                  mode={inviteType === 'phone' ? 'contained' : 'text'}
                  onPress={() => setInviteType('phone')}
                  style={{ borderRadius: 20, marginLeft: 4, backgroundColor: inviteType === 'phone' ? colors.primary : 'transparent', minWidth: 100 }}
                  labelStyle={{ color: inviteType === 'phone' ? colors.onPrimary : colors.onSurfaceVariant, fontWeight: 'bold' }}
                >
                  By Phone
                </Button>
              </View>
              {/* Input with icon */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Avatar.Icon icon={inviteType === 'email' ? 'email' : 'phone'} size={36} style={{ backgroundColor: colors.elevation.level1, marginRight: 10 }} />
                <TextInput
                  label={inviteType === 'email' ? 'Email Address' : 'Phone Number'}
                  placeholder={inviteType === 'email' ? 'Enter email address' : 'Enter phone number'}
                  value={identifier}
                  onChangeText={setIdentifier}
                  keyboardType={inviteType === 'phone' ? 'phone-pad' : 'email-address'}
                  style={{ flex: 1, fontSize: 17, borderRadius: 10, backgroundColor: colors.background }}
                  mode="outlined"
                  autoFocus
                  left={<TextInput.Icon icon={inviteType === 'email' ? 'email' : 'phone'} />} 
                />
              </View>
            </Dialog.Content>
            <Dialog.Actions style={{ flexDirection: 'column', alignItems: 'stretch', paddingHorizontal: 24, paddingBottom: 24 }}>
              <Button
                mode="contained"
                onPress={handleSendFriendRequest}
                loading={isSendingRequest}
                style={{ borderRadius: 10, marginBottom: 10, height: 48, justifyContent: 'center', backgroundColor: colors.primary }}
                labelStyle={{ fontWeight: 'bold', fontSize: 17, color: colors.onPrimary }}
                contentStyle={{ height: 48 }}
              >
                Send Friend Request
              </Button>
              <Button
                mode="text"
                onPress={() => setShowAddFriend(false)}
                style={{ borderRadius: 10, height: 44, justifyContent: 'center' }}
                labelStyle={{ fontWeight: 'bold', fontSize: 16, color: colors.onSurfaceVariant }}
                contentStyle={{ height: 44 }}
              >
                Cancel
              </Button>
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
      </ScrollView>
    </Surface>
  );
} 