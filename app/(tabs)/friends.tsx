import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Inbox, UserPlus } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Dialog, IconButton, Portal, Snackbar, Surface, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FriendCard } from '../../components/FriendCard'; // Import the new component
import { ModernButton } from '../../components/ui/ModernButton';
import { ModernInput } from '../../components/ui/ModernInput';
import { acceptFriendRequest, getFriends, getIncomingFriendRequests, getSplitExpensesForUser, getUserProfile, rejectFriendRequest, removeFriend, sendFriendRequest } from '../../firebase/firestore';
import { useAuth } from '../../hooks/useAuth';

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
  const [showRemoveFriendDialog, setShowRemoveFriendDialog] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<any>(null);
  const [isRemovingFriend, setIsRemovingFriend] = useState(false);
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

  const handleRemoveFriend = async () => {
    if (!authUser || !friendToRemove) return;
    setIsRemovingFriend(true);
    try {
      await removeFriend(authUser.uid, friendToRemove.uid);
      setSnackbar({ visible: true, message: `${friendToRemove.displayName || friendToRemove.email} has been removed from your friends.` });
      fetchInitialData(); // Refresh the list
    } catch (error: any) {
      setSnackbar({ visible: true, message: error.message || 'Could not remove friend.', error: true });
    } finally {
      setIsRemovingFriend(false);
      setShowRemoveFriendDialog(false);
      setFriendToRemove(null);
    }
  };
 
   // UI styles
   const styles = StyleSheet.create({
     container: {
       flex: 1,
       backgroundColor: colors.background,
       paddingTop: insets.top,
     },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 16,
    },
    headerContent: {
      flex: 1,
    },
    title: {
      fontWeight: 'bold',
      fontSize: 30,
      color: colors.primary,
      marginBottom: 2,
      letterSpacing: -0.5,
    },
    subtitle: {
      color: colors.onSurfaceVariant,
      fontSize: 16,
      marginBottom: 18,
    },
    cardTitle: {
      fontWeight: 'bold',
      fontSize: 21,
      color: colors.primary,
      marginBottom: 2,
      marginTop: 16,
      marginLeft: 22,
      letterSpacing: -0.2,
    },
    cardSubtitle: {
      color: colors.onSurfaceVariant,
      fontSize: 15,
      marginBottom: 10,
      marginLeft: 22,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    requestCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 18,
      marginBottom: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: dark ? colors.elevation.level1 : colors.surface,
      borderWidth: 1,
      borderColor: dark ? colors.outline : '#e0e0e0',
    },
    requestInfo: {
      flex: 1,
      marginLeft: 12,
    },
    requestButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    dialog: {
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    dialogContent: {
      paddingTop: 24,
      paddingBottom: 12,
      paddingHorizontal: 24,
    },
    pillSwitcher: {
      flexDirection: 'row',
      alignSelf: 'center',
      marginBottom: 20,
      backgroundColor: dark ? colors.elevation.level1 : '#f3f4f6',
      borderRadius: 24,
      padding: 4,
    },
    pillBtn: {
      borderRadius: 20,
      minWidth: 110,
      marginHorizontal: 2,
      height: 40,
      justifyContent: 'center',
    },
    pillLabel: {
      fontWeight: 'bold',
      fontSize: 16,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    input: {
      flex: 1,
      fontSize: 17,
      borderRadius: 12,
      backgroundColor: colors.background,
    },
    dialogActions: {
      flexDirection: 'column',
      alignItems: 'stretch',
      paddingHorizontal: 24,
      paddingBottom: 24,
    },
    sendBtn: {
      borderRadius: 12,
      marginBottom: 10,
      height: 48,
      justifyContent: 'center',
      backgroundColor: colors.primary,
      elevation: 2,
    },
    sendLabel: {
      fontWeight: 'bold',
      fontSize: 17,
      color: colors.onPrimary,
    },
    cancelBtn: {
      borderRadius: 12,
      height: 44,
      justifyContent: 'center',
    },
    cancelLabel: {
      fontWeight: 'bold',
      fontSize: 16,
      color: colors.onSurfaceVariant,
    },
  });

  return (
    <Surface style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Friends</Text>
            <Text style={styles.subtitle}>Manage your connections for easy expense splitting and sharing.</Text>
          </View>
          <IconButton
            icon={() => <UserPlus size={24} color={colors.primary} />}
            onPress={() => setShowAddFriend(true)}
            size={24}
            containerColor={colors.surfaceVariant}
            mode="contained"
            style={{ borderRadius: 12, width: 48, height: 48, marginLeft: 12 }}
          />
        </View>
        {/* Incoming Friend Requests */}
        <View style={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 10 }}>
          <Text style={styles.cardTitle}>Incoming Friend Requests</Text>
          <Text style={styles.cardSubtitle}>Respond to users who want to connect with you.</Text>
        </View>
        {isLoadingRequests ? (
          <ActivityIndicator style={{ marginVertical: 24 }} />
        ) : incomingRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Inbox size={48} color={colors.onSurfaceVariant} style={{ marginBottom: 16 }} />
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 17, fontWeight: '600', marginBottom: 4, textAlign: 'center' }}>No incoming friend requests.</Text>
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
              When someone sends you a request, it will appear here.
            </Text>
          </View>
        ) : (
          incomingRequests.map((request: any) => (
            <View key={request.id} style={styles.requestCard}>
              <Avatar.Text size={44} label={request.fromUserDisplayName ? request.fromUserDisplayName[0] : '?'} />
              <View style={styles.requestInfo}>
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: colors.onBackground }}>{request.fromUserDisplayName || request.fromUserEmail}</Text>
                <Text style={{ color: colors.onSurfaceVariant, fontSize: 13 }}>{request.fromUserEmail}</Text>
              </View>
              <View style={styles.requestButtons}>
                <ModernButton
                  title="Accept"
                  onPress={() => handleAcceptRequest(request)}
                  loading={isProcessingRequest === request.id}
                  style={{ height: 38, paddingHorizontal: 12 }}
                  textStyle={{ fontWeight: 'bold' }}
                />
                <ModernButton
                  title="Reject"
                  onPress={() => handleRejectRequest(request.id)}
                  loading={isProcessingRequest === request.id}
                  variant="outline"
                  style={{ height: 38, paddingHorizontal: 12, borderColor: colors.error }}
                  textStyle={{ fontWeight: 'bold', color: colors.error }}
                />
              </View>
            </View>
          ))
        )}
        {/* Your Friends */}
        <View style={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 10 }}>
          <Text style={styles.cardTitle}>Your Friends</Text>
          <Text style={styles.cardSubtitle}>List of your current connections.</Text>
        </View>
        {isLoadingFriends ? (
          <ActivityIndicator style={{ marginVertical: 24 }} />
        ) : friends.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-group-outline" size={48} color={colors.onSurfaceVariant} style={{ marginBottom: 16 }} />
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 17, fontWeight: '600', marginBottom: 4, textAlign: 'center' }}>No friends found.</Text>
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
              When you add friends, they will appear here.
            </Text>
          </View>
        ) : (
          friends.map((friend: any) => (
            <FriendCard
              key={friend.uid}
              friend={friend}
              friendBalances={friendBalances}
              onRemoveFriend={(f: any) => {
                setFriendToRemove(f);
                setShowRemoveFriendDialog(true);
              }}
            />
          ))
        )}
        {/* Add Friend Dialog */}
        <Portal>
          <Dialog visible={showAddFriend} onDismiss={() => setShowAddFriend(false)} style={styles.dialog}>
            <Dialog.Content style={styles.dialogContent}>
              <Text style={{ fontWeight: 'bold', fontSize: 22, textAlign: 'center', marginBottom: 4, color: colors.primary }}>Add New Friend</Text>
              <Text style={{ color: colors.onSurfaceVariant, fontSize: 15, textAlign: 'center', marginBottom: 18 }}>Invite by email or phone to start splitting expenses.</Text>
              {/* Pill-style tab switcher */}
              <View style={styles.pillSwitcher}>
                <ModernButton
                  title="By Email"
                  onPress={() => setInviteType('email')}
                  variant={inviteType === 'email' ? 'primary' : 'ghost'}
                  style={{ ...styles.pillBtn, backgroundColor: inviteType === 'email' ? colors.primary : 'transparent' }}
                  textStyle={{ ...styles.pillLabel, color: inviteType === 'email' ? colors.onPrimary : colors.onSurfaceVariant }}
                />
                <ModernButton
                  title="By Phone"
                  onPress={() => setInviteType('phone')}
                  variant={inviteType === 'phone' ? 'primary' : 'ghost'}
                  style={{ ...styles.pillBtn, backgroundColor: inviteType === 'phone' ? colors.primary : 'transparent' }}
                  textStyle={{ ...styles.pillLabel, color: inviteType === 'phone' ? colors.onPrimary : colors.onSurfaceVariant }}
                />
              </View>
              {/* Input with icon */}
              <View style={styles.inputRow}>
                <Avatar.Icon icon={inviteType === 'email' ? 'email' : 'phone'} size={36} style={{ backgroundColor: colors.elevation.level1, marginRight: 10 }} />
                <ModernInput
                  label={inviteType === 'email' ? 'Email Address' : 'Phone Number'}
                  placeholder={inviteType === 'email' ? 'Enter email address' : 'Enter phone number'}
                  value={identifier}
                  onChangeText={setIdentifier}
                  keyboardType={inviteType === 'phone' ? 'phone-pad' : 'email-address'}
                  style={styles.input}
                  autoFocus
                  leftIcon={<MaterialCommunityIcons name={inviteType === 'email' ? 'email' : 'phone'} size={20} color={colors.onSurfaceVariant} />}
                />
              </View>
            </Dialog.Content>
            <Dialog.Actions style={styles.dialogActions}>
              <ModernButton
                title="Send Friend Request"
                onPress={handleSendFriendRequest}
                loading={isSendingRequest}
                style={styles.sendBtn}
                textStyle={styles.sendLabel}
              />
              <ModernButton
                title="Cancel"
                onPress={() => setShowAddFriend(false)}
                variant="ghost"
                style={styles.cancelBtn}
                textStyle={styles.cancelLabel}
              />
            </Dialog.Actions>
          </Dialog>

          {/* Remove Friend Confirmation Dialog */}
          <Dialog visible={showRemoveFriendDialog} onDismiss={() => setShowRemoveFriendDialog(false)} style={styles.dialog}>
            <Dialog.Title style={{ fontWeight: 'bold', fontSize: 20, textAlign: 'center', color: colors.error }}>Remove Friend</Dialog.Title>
            <Dialog.Content style={styles.dialogContent}>
              <Text style={{ fontSize: 16, textAlign: 'center', color: colors.onSurfaceVariant }}>
                Are you sure you want to remove {friendToRemove?.displayName || friendToRemove?.email} from your friends? This action cannot be undone.
              </Text>
            </Dialog.Content>
            <Dialog.Actions style={styles.dialogActions}>
              <ModernButton
                title="Remove Friend"
                onPress={handleRemoveFriend}
                loading={isRemovingFriend}
                style={{ ...styles.sendBtn, backgroundColor: colors.error }}
                textStyle={styles.sendLabel}
              />
              <ModernButton
                title="Cancel"
                onPress={() => setShowRemoveFriendDialog(false)}
                variant="ghost"
                style={styles.cancelBtn}
                textStyle={styles.cancelLabel}
              />
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