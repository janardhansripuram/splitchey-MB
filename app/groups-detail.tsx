import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Clipboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import { ActivityIndicator, Avatar, Badge, Button, Card, Checkbox, Dialog, Divider, IconButton, List, Menu, Portal, Snackbar, Surface, Text, TextInput, Tooltip, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GroupButton from '../components/ui/GroupButton';
import { ChatMessage, Expense, Group, GroupActivityLogEntry, SplitExpense, SplitParticipant } from '../constants/types';
import { db, storage } from '../firebase/config';
import { addChatMessage, addContributionToGroupGoal, addGroupSavingsGoal, addMembersToGroup, getChatMessages, getContributionsForGroupGoal, getExpensesByGroupId, getFriends, getGroupActivityLog, getGroupDetails, getGroupSavingsGoalsByGroupId, getSplitExpensesByGroupId, removeMemberFromGroup, transferGroupOwnership, updateGroupDetails, updateGroupImageUrl, updateMemberRole, settleDebtWithWallet, requestSettlementApproval, approveSettlement, rejectSettlement, getUserProfile } from '../firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import AddExpensesSheet from './expenses-add';
import SettlementModal from '../components/SettlementModal';
import ApprovalModal from '../components/ApprovalModal';

const TABS = [
  { key: 'expenses', label: 'Expenses', icon: 'currency-usd' },
  { key: 'splits', label: 'Splits', icon: 'scale-balance' },
  { key: 'members', label: 'Members', icon: 'account-multiple' },
  { key: 'activity', label: 'Activity', icon: 'history' },
  { key: 'chat', label: 'Chat', icon: 'chat' },
  { key: 'savings', label: 'Savings', icon: 'wallet-outline' },
];

// Add a helper style for vertical button stacks in dialogs
const dialogButtonStack = { flexDirection: 'column', gap: 10, alignItems: 'stretch', width: '100%' };

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<any>(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splits, setSplits] = useState<SplitExpense[]>([]);
  const [tab, setTab] = useState('expenses');
  const [activityLog, setActivityLog] = useState<GroupActivityLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const chatScrollRef = useRef<any>(null);
  const router = useRouter();
  const { colors, dark } = useTheme();
  const { authUser, userProfile } = useAuth();
  const [savingsGoals, setSavingsGoals] = useState<any[]>([]);
  const [savingsLoading, setSavingsLoading] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [goalCurrency, setGoalCurrency] = useState('MYR');
  const [addingGoal, setAddingGoal] = useState(false);
  const [menuVisible, setMenuVisible] = useState<{ [uid: string]: boolean }>({});
  const [loadingAction, setLoadingAction] = useState<{ [uid: string]: boolean }>({});
  const [userProfiles, setUserProfiles] = useState<{ [uid: string]: any }>({});
  // Add state for new modal
  const [addMemberTab, setAddMemberTab] = useState<'friends' | 'email' | 'phone' | 'link'>('friends');
  const [friendsNotInGroup, setFriendsNotInGroup] = useState<any[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<{ [uid: string]: boolean }>({});
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'valid' | 'invalid' | 'error'>('idle');
  const [phoneStatus, setPhoneStatus] = useState<'idle' | 'valid' | 'invalid' | 'error'>('idle');
  const [emailUser, setEmailUser] = useState<any>(null);
  const [phoneUser, setPhoneUser] = useState<any>(null);
  const [inviteLink, setInviteLink] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [addingFriends, setAddingFriends] = useState(false);
  const [addingByEmail, setAddingByEmail] = useState(false);
  const [addingByPhone, setAddingByPhone] = useState(false);
  // Add state for snackbar
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; color?: string }>({ visible: false, message: '' });
  const [contributionModal, setContributionModal] = useState<{ open: boolean; goal: any | null }>({ open: false, goal: null });
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributionNotes, setContributionNotes] = useState('');
  const [contributionLoading, setContributionLoading] = useState(false);
  const [goalContributions, setGoalContributions] = useState<{ [goalId: string]: any[] }>({});
  const [contributionError, setContributionError] = useState('');
  // Add state for edit modal
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editGroupName, setEditGroupName] = useState(group?.name || '');
  const [editGroupImage, setEditGroupImage] = useState<string | null>(group?.imageUrl || null);
  const [editGroupLoading, setEditGroupLoading] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false); // New state for AddExpenseModal
  const insets = useSafeAreaInsets();

  // Settlement-related state
  const [isProcessingSettlement, setIsProcessingSettlement] = useState<string | null>(null);
  const [settlementModal, setSettlementModal] = useState<{ open: boolean; split: SplitExpense | null; participant: SplitParticipant | null }>({ open: false, split: null, participant: null });
  const [approvalModal, setApprovalModal] = useState<{ open: boolean; split: SplitExpense | null; participant: SplitParticipant | null }>({ open: false, split: null, participant: null });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [groupData, expensesData, splitsData] = await Promise.all([
          getGroupDetails(groupId as string),
          getExpensesByGroupId(groupId as string),
          getSplitExpensesByGroupId(groupId as string),
        ]);
        setGroup(groupData);
        setExpenses(expensesData);
        setSplits(splitsData);

        // Fetch user profiles for all participants in splits
        if (splitsData && splitsData.length > 0) {
          const allUserIds = new Set<string>();
          splitsData.forEach(split => {
            split.participants.forEach(participant => {
              allUserIds.add(participant.userId);
            });
          });

          const profilePromises = Array.from(allUserIds).map(async (userId) => {
            try {
              const profile = await getUserProfile(userId);
              return { userId, profile };
            } catch (error) {
              console.error(`Failed to fetch profile for user ${userId}:`, error);
              return { userId, profile: null };
            }
          });

          const profileResults = await Promise.all(profilePromises);
          const profilesMap: { [uid: string]: any } = {};
          profileResults.forEach(({ userId, profile }) => {
            if (profile) {
              profilesMap[userId] = profile;
            }
          });
          setUserProfiles(profilesMap);
        }
      } catch (e) {
        Alert.alert('Error', 'Failed to load group data.');
      }
      setLoading(false);
    };
    if (groupId) fetchData();
  }, [groupId]);

  // Activity log
  useEffect(() => {
    if (tab === 'activity' && groupId) {
      setActivityLoading(true);
      getGroupActivityLog(groupId as string, 30).then(setActivityLog).finally(() => setActivityLoading(false));
    }
  }, [tab, groupId]);

  // Chat real-time listener
  useEffect(() => {
    if (tab === 'chat' && groupId) {
      const unsubscribe = getChatMessages(groupId as string, (msgs) => {
        setChatMessages(msgs);
        setTimeout(() => {
          if (chatScrollRef.current) chatScrollRef.current.scrollToEnd({ animated: true });
        }, 100);
      });
      return () => unsubscribe();
    }
  }, [tab, groupId]);

  // Savings goals real-time listener
  useEffect(() => {
    if (tab === 'savings' && groupId) {
      setSavingsLoading(true);
      getGroupSavingsGoalsByGroupId(String(groupId)).then(async (goals) => {
        setSavingsGoals(goals);
        // Fetch contributions for each goal
        const contributionsMap: { [goalId: string]: any[] } = {};
        await Promise.all(goals.map(async (goal: any) => {
          const contributions = await getContributionsForGroupGoal(goal.id);
          console.log('Contributions for goal', goal.id, contributions); // Debug log
          contributionsMap[goal.id] = contributions;
        }));
        setGoalContributions(contributionsMap);
      }).finally(() => setSavingsLoading(false));
    }
  }, [tab, groupId]);

  // Fetch friends not in group when modal opens
  useEffect(() => {
    if (showAddMember && group && userProfile) {
      (async () => {
        // Fetch friends from Firestore (real data)
        const allFriends = await getFriends(userProfile.uid);
        // Use 'uid' or 'id' as needed for your Firestore structure
        const notInGroup = allFriends.filter((f: any) => !group.memberIds.includes(f.uid || f.id));
        setFriendsNotInGroup(notInGroup);
        setSelectedFriends({});
      })();
    }
  }, [showAddMember, group, userProfile]);

  // Email validation
  const validateEmail = async () => {
    setEmailStatus('idle');
    setEmailUser(null);
    if (!emailInput.trim()) return;
    try {
      // Query users collection by email
      const q = query(collection(db, 'users'), where('email', '==', emailInput.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setEmailUser({ ...snap.docs[0].data(), uid: snap.docs[0].id });
        setEmailStatus('valid');
      } else {
        setEmailStatus('invalid');
      }
    } catch {
      setEmailStatus('error');
    }
  };
  // Phone validation
  const validatePhone = async () => {
    setPhoneStatus('idle');
    setPhoneUser(null);
    if (!phoneInput.trim()) return;
    try {
      const q = query(collection(db, 'users'), where('phoneNumber', '==', phoneInput.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setPhoneUser({ ...snap.docs[0].data(), uid: snap.docs[0].id });
        setPhoneStatus('valid');
      } else {
        setPhoneStatus('invalid');
      }
    } catch {
      setPhoneStatus('error');
    }
  };
  // Generate invite link
  const handleGenerateInviteLink = async () => {
    setGeneratingLink(true);
    // Generate a unique token (could use groupId + timestamp or a random string)
    const token = `${group?.id}-${Date.now()}`;
    // Save invite to Firestore if needed
    const link = `https://yourapp.com/join/${token}`;
    setInviteLink(link);
    setGeneratingLink(false);
  };
  // Add selected friends
  const handleAddSelectedFriends = async () => {
    setAddingFriends(true);
    try {
      const toAdd = Object.keys(selectedFriends).filter(uid => selectedFriends[uid]);
      if (toAdd.length === 0) return;
      const friendProfiles = friendsNotInGroup.filter(f => toAdd.includes(f.uid || f.id));
      await addMembersToGroup(group?.id as string, userProfile, friendProfiles.map(f => ({ uid: f.uid || f.id, email: f.email, displayName: f.displayName })));
      setSnackbar({ visible: true, message: 'Members added successfully!', color: 'green' });
      setShowAddMember(false);
      // Refresh group data
      const updated = await getGroupDetails(group?.id as string);
      setGroup(updated);
    } catch (e) {
      setSnackbar({ visible: true, message: 'Failed to add members.', color: 'red' });
    }
    setAddingFriends(false);
  };
  // Add by email
  const handleAddByEmail = async () => {
    setAddingByEmail(true);
    try {
      if (!emailUser) return;
      await addMembersToGroup(group?.id as string, userProfile, [{ uid: emailUser.uid, email: emailUser.email, displayName: emailUser.displayName }]);
      setSnackbar({ visible: true, message: 'Member added by email!', color: 'green' });
      setShowAddMember(false);
      const updated = await getGroupDetails(group?.id as string);
      setGroup(updated);
    } catch (e) {
      setSnackbar({ visible: true, message: 'Failed to add by email.', color: 'red' });
    }
    setAddingByEmail(false);
  };
  // Add by phone
  const handleAddByPhone = async () => {
    setAddingByPhone(true);
    try {
      if (!phoneUser) return;
      await addMembersToGroup(group?.id as string, userProfile, [{ uid: phoneUser.uid, email: phoneUser.email, displayName: phoneUser.displayName, phoneNumber: phoneUser.phoneNumber }]);
      setSnackbar({ visible: true, message: 'Member added by phone!', color: 'green' });
      setShowAddMember(false);
      const updated = await getGroupDetails(group?.id as string);
      setGroup(updated);
    } catch (e) {
      setSnackbar({ visible: true, message: 'Failed to add by phone.', color: 'red' });
    }
    setAddingByPhone(false);
  };

  // Helper: get role badge
  const getRoleBadge = (role: string) => {
    if (role === 'creator') return <Badge style={{ backgroundColor: colors.primary, marginLeft: 8 }}>Creator</Badge>;
    if (role === 'admin') return <Badge style={{ backgroundColor: colors.secondary, marginLeft: 8 }}>Admin</Badge>;
    return <Badge style={{ backgroundColor: colors.elevation.level2, marginLeft: 8 }}>Member</Badge>;
  };

  // Helper: get your role
  const getYourRole = () => {
    // TODO: Replace with actual user ID from auth
    const yourId = 'demo-user-id';
    const member = group?.memberDetails.find((m: any) => m.uid === yourId);
    return member?.role || 'member';
  };

  const handleDelete = async () => {
    Alert.alert('Delete Group', 'Are you sure you want to delete this group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            // await deleteGroup(groupId as string);
            Alert.alert('Deleted', 'Group deleted.');
            router.back();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete group.');
          }
        }
      }
    ]);
  };

  // Open edit modal and prefill values
  const handleEdit = () => {
    setEditGroupName(group?.name || '');
    setEditGroupImage(group?.imageUrl || null);
    setShowEditGroupModal(true);
  };

  // Update handlePickImage to immediately upload and update the group image if a new image is selected
  const handlePickImage = async () => {
    if (!group) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: false,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const imageRef = ref(storage, `group-images/${group.id}`);
        await uploadBytes(imageRef, blob);
        const downloadUrl = await getDownloadURL(imageRef);
        await updateGroupImageUrl(group.id, downloadUrl);
        // Refresh group details
        const updated = await getGroupDetails(group.id);
        setGroup(updated);
      } catch (e) {
        Alert.alert('Error', 'Failed to update group image.');
      }
    }
  };

  // Save handler
  const handleSaveGroupEdit = async () => {
    if (!group) return;
    setEditGroupLoading(true);
    try {
      if (editGroupName.trim() && editGroupName.trim() !== group.name) {
        await updateGroupDetails(group.id, userProfile, { name: editGroupName.trim() });
      }
      if (editGroupImage && editGroupImage !== group.imageUrl) {
        // Upload image to Firebase Storage
        const response = await fetch(editGroupImage);
        const blob = await response.blob();
        const imageRef = ref(storage, `group-images/${group.id}`);
        await uploadBytes(imageRef, blob);
        const downloadUrl = await getDownloadURL(imageRef);
        await updateGroupImageUrl(group.id, downloadUrl);
      }
      // Refresh group details
      const updated = await getGroupDetails(group.id);
      setGroup(updated);
      setShowEditGroupModal(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to update group.');
    }
    setEditGroupLoading(false);
  };

  const handleAddMember = async () => {
    if (!newMember) return;
    setAddingMember(true);
    try {
      // await addMemberToGroup(groupId, newMember)
      setGroup((g: any) => ({
        ...g,
        members: [...g.members, { id: Date.now().toString(), displayName: newMember, email: `${newMember}@example.com` }],
      }));
      setShowAddMember(false);
      setNewMember('');
    } catch (e) {
      Alert.alert('Error', 'Failed to add member.');
    }
    setAddingMember(false);
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    setRemovingMember(true);
    try {
      // await removeMemberFromGroup(groupId, memberToRemove.id)
      setGroup((g: any) => ({
        ...g,
        members: g.members.filter((m: any) => m.id !== memberToRemove.id),
      }));
      setMemberToRemove(null);
    } catch (e) {
      Alert.alert('Error', 'Failed to remove member.');
    }
    setRemovingMember(false);
  };

  const handleSplitExpense = () => {
    // Navigate to split expense screen (to be implemented)
    router.push({ pathname: '/groups-split', params: { groupId: String(groupId) } });
  };

  // Send chat message (placeholder, needs backend function)
  const handleSendChat = async () => {
    if (!chatInput.trim() || !authUser || !userProfile) return;
    setSendingChat(true);
    try {
      await addChatMessage(
        groupId as string,
        authUser.uid,
        userProfile.displayName || userProfile.email || 'User',
        userProfile.photoURL || null,
        chatInput.trim()
      );
      setChatInput('');
    } catch (e) {
      Alert.alert('Error', 'Failed to send message.');
    }
    setSendingChat(false);
  };

  const handleAddGoal = async () => {
    if (!goalName.trim() || !goalAmount || !goalCurrency) return;
    setAddingGoal(true);
    try {
      await addGroupSavingsGoal(
        userProfile,
        groupId as string,
        {
          name: goalName.trim(),
          targetAmount: parseFloat(goalAmount),
          currency: goalCurrency,
          targetDate: null // or add a date picker if you want
        }
      );
      setShowAddGoal(false);
      setGoalName('');
      setGoalAmount('');
      setGoalCurrency('MYR');
      setSavingsLoading(true);
      const goals = await getGroupSavingsGoalsByGroupId(groupId as string);
      setSavingsGoals(goals);
      setSavingsLoading(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to add goal.');
    }
    setAddingGoal(false);
  };

  // 2. Remove lazy loading of contributions from openContributionModal
  const openContributionModal = (goal: any) => {
    setContributionAmount('');
    setContributionNotes('');
    setContributionError('');
    setContributionModal({ open: true, goal });
  };
  const closeContributionModal = () => setContributionModal({ open: false, goal: null });
  const handleAddContribution = async () => {
    // Debug log all relevant values
    console.log('handleAddContribution called with:', {
      goal: contributionModal.goal,
      goalId: contributionModal.goal?.id,
      userProfile,
      userProfileUid: userProfile?.uid,
      contributionAmount,
      contributionNotes,
    });
    // Robust validation
    if (!contributionModal.goal || !contributionModal.goal.id) {
      setContributionError('Goal information is missing.');
      return;
    }
    if (!userProfile || !userProfile.uid) {
      setContributionError('User profile is missing. Please re-login.');
      return;
    }
    if (!contributionAmount || isNaN(Number(contributionAmount)) || Number(contributionAmount) <= 0) {
      setContributionError('Enter a valid amount.');
      return;
    }
    setContributionLoading(true);
    try {
      await addContributionToGroupGoal(
        userProfile,
        String(groupId),
        contributionModal.goal.id,
        { amount: contributionAmount, notes: contributionNotes }
      );
      // Refetch all savings goals and their contributions after a successful contribution
      setSavingsLoading(true);
      getGroupSavingsGoalsByGroupId(String(groupId)).then(async (goals) => {
        setSavingsGoals(goals);
        const contributionsMap: { [goalId: string]: any[] } = {};
        await Promise.all(goals.map(async (goal: any) => {
          const contributions = await getContributionsForGroupGoal(goal.id);
          contributionsMap[goal.id] = contributions;
        }));
        setGoalContributions(contributionsMap);
      }).finally(() => setSavingsLoading(false));
      setContributionModal({ open: false, goal: null });
    } catch (e) {
      console.error('Failed to add contribution:', e);
      setContributionError('Failed to add contribution.');
    }
    setContributionLoading(false);
  };

  // Settlement handlers
  const handleSettleWithWallet = async (splitId: string, participantId: string, amount: number, currency: string) => {
    setIsProcessingSettlement(`${splitId}-${participantId}`);
    try {
      await settleDebtWithWallet(splitId, participantId);
      setSnackbar({ visible: true, message: `Settlement Successful! You paid your share of ${currency} ${amount} from your wallet.` });
      // Refresh splits data
      const updatedSplits = await getSplitExpensesByGroupId(groupId as string);
      setSplits(updatedSplits);
    } catch (error: any) {
      console.error("Error settling with wallet:", error);
      setSnackbar({ visible: true, message: error.message || "Could not complete wallet settlement.", color: colors.error });
    } finally {
      setIsProcessingSettlement(null);
    }
  };

  const handleRequestManualSettlement = async (splitId: string) => {
    if (!userProfile) return;
    setIsProcessingSettlement(splitId);
    try {
      await requestSettlementApproval(splitId, userProfile);
      setSnackbar({ visible: true, message: "Request Sent! The payer has been notified to approve your manual settlement." });
      // Refresh splits data
      const updatedSplits = await getSplitExpensesByGroupId(groupId as string);
      setSplits(updatedSplits);
    } catch (error: any) {
      console.error("Error requesting manual settlement:", error);
      setSnackbar({ visible: true, message: error.message || "Could not send settlement request.", color: colors.error });
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
      // Refresh splits data
      const updatedSplits = await getSplitExpensesByGroupId(groupId as string);
      setSplits(updatedSplits);
    } catch (error: any) {
      console.error("Error approving settlement:", error);
      setSnackbar({ visible: true, message: error.message || "Could not approve the settlement.", color: colors.error });
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
      // Refresh splits data
      const updatedSplits = await getSplitExpensesByGroupId(groupId as string);
      setSplits(updatedSplits);
    } catch (error: any) {
      console.error("Error rejecting settlement:", error);
      setSnackbar({ visible: true, message: error.message || "Could not reject the settlement.", color: colors.error });
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

  if (loading) {
    return <Surface style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><ActivityIndicator animating color={colors.primary} size="large" /><Text>Loading...</Text></Surface>;
  }

  if (!group) {
    return <Surface style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><Text>Group not found.</Text></Surface>;
  }

  // Tab styles (match login page)
  const tabBarStyles = StyleSheet.create({
    container: {
      flexDirection: 'row' as ViewStyle['flexDirection'],
      backgroundColor: colors.elevation.level1,
      borderRadius: 8,
      marginHorizontal: 12,
      marginTop: 18,
      marginBottom: 8,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.outline,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center' as ViewStyle['alignItems'],
    },
    tabActive: {
      fontWeight: '700',
      color: colors.onBackground,
    },
    tabInactive: {
      fontWeight: '400',
      color: colors.onSurfaceVariant,
    },
    tabText: {
      fontSize: 16,
    } as TextStyle,
    tabTextActive: {
      fontWeight: '700' as TextStyle['fontWeight'],
      color: colors.onBackground,
    } as TextStyle,
    tabTextInactive: {
      fontWeight: '400' as TextStyle['fontWeight'],
      color: colors.onSurfaceVariant,
    } as TextStyle,
  });

  return (
    <Surface style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Close Button */}
      <IconButton
        icon="close"
        size={28}
        onPress={() => router.back()}
        style={{ position: 'absolute', top: insets.top + 8, right: 8, zIndex: 10, backgroundColor: colors.elevation.level2 }}
        iconColor={colors.onSurface}
        accessibilityLabel="Close"
      />
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 0 }}>
        {/* <Button onPress={() => router.back()} mode="text" style={{ marginRight: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </Button> */}
        {group.imageUrl ? (
          <View style={{ position: 'relative', marginRight: 12 }}>
            <TouchableOpacity onPress={handlePickImage} activeOpacity={0.7}>
              <View style={{ width: 75, height: 75, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}>
                <Avatar.Image source={{ uri: group.imageUrl }} size={75} style={{ backgroundColor: 'transparent' }} />
              </View>
              <View style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: colors.background, borderRadius: 12, padding: 2 }}>
                <Avatar.Icon icon="camera" size={24} style={{ backgroundColor: colors.primary }} />
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ position: 'relative', marginRight: 12 }}>
            <TouchableOpacity onPress={handlePickImage} activeOpacity={0.7}>
              <View style={{ width: 96, height: 96, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}>
                <Avatar.Icon icon="account" size={96} style={{ backgroundColor: 'transparent' }} />
              </View>
              <View style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: colors.background, borderRadius: 12, padding: 2 }}>
                <Avatar.Icon icon="camera" size={24} style={{ backgroundColor: colors.primary }} />
              </View>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text variant="headlineMedium" style={{ fontWeight: 'bold', color: '#8b5cf6', marginRight: 8 }}>{group.name}</Text>
            <IconButton icon="pencil" size={20} onPress={handleEdit} style={{ margin: 0 }} />
          </View>
          <Text style={{ color: colors.onSurfaceVariant, fontSize: 14 }}>
            Created by: {group.memberDetails.find((m: any) => m.uid === group.createdBy)?.displayName || group.memberDetails.find((m: any) => m.uid === group.createdBy)?.email || 'Unknown'} | {group.memberDetails.length} members
          </Text>
        </View>
      </View>
      {/* Tabs (login style) */}
      <View style={{ marginTop: 16, marginBottom: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ height: 44, backgroundColor: 'transparent' }}
          contentContainerStyle={{ alignItems: 'center' }}
        >
          <View style={{
            flexDirection: 'row',
            backgroundColor: dark ? colors.elevation.level1 : '#f3f4f6',
            borderRadius: 8,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: dark ? colors.outline : '#e5e7eb',
            minHeight: 44,
            alignItems: 'center',
          }}>
            {TABS.map(t => (
              <TouchableOpacity
                key={t.key}
                style={{
                  minWidth: 110,
                  flexShrink: 1,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: tab === t.key ? (dark ? colors.background : '#fff') : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => setTab(t.key)}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: tab === t.key ? '700' : '400',
                  color: tab === t.key ? colors.onBackground : colors.onSurfaceVariant,
                  textAlign: 'center',
                }}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
      {/* Tab Content */}
      <View style={{ flex: 1 }}>
        {tab === 'expenses' && (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
            style={{ flex: 1 }}
          >
            <Card style={{ backgroundColor: colors.surface, borderRadius: 18, elevation: 2, marginBottom: 16 }}>
              <Card.Content>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="cash-outline" size={22} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={{ fontWeight: 'bold', fontSize: 20, color: colors.onSurface }}>Group Expenses</Text>
                </View>
                <Text style={{ color: colors.onSurfaceVariant, marginBottom: 12 }}>Expenses associated with {group.name}.</Text>
                {expenses.length === 0 ? (
                  <Text style={{ color: colors.outline, textAlign: 'center', marginVertical: 32 }}>No expenses yet.</Text>
                ) : (
                  expenses.map(exp => (
                    <View key={exp.id} style={{ backgroundColor: colors.elevation.level1, borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 2, color: colors.onSurface }}>{exp.description}</Text>
                        <Text style={{ color: colors.onSurfaceVariant, fontSize: 13 }}>{new Date(exp.date).toLocaleDateString()} - {exp.category || 'General'}</Text>
                        <Text style={{ color: colors.onSurfaceVariant, fontSize: 13 }}>Added by: {group.memberDetails.find((m: any) => m.uid === exp.userId)?.displayName || 'User'}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 16, color: colors.primary, marginBottom: 8 }}>{exp.currency} {exp.amount}</Text>
                        <Button mode="outlined" icon="pencil" compact onPress={() => router.push(`/expenses-edit?expenseId=${exp.id}`)} style={{ borderRadius: 8, borderColor: colors.outline }} labelStyle={{ fontSize: 13 }}>
                          Edit Expense
                        </Button>
                      </View>
                    </View>
                  ))
                )}
                <Button mode="contained" icon="plus" style={{ marginTop: 16, borderRadius: 8, backgroundColor: colors.primary }} contentStyle={{ height: 48 }} labelStyle={{ fontWeight: 'bold', fontSize: 16 }} onPress={() => setShowAddExpenseModal(true)}>
                  Add New Expense to This Group
                </Button>
                <Portal>
                  <Dialog visible={showAddExpenseModal} onDismiss={() => setShowAddExpenseModal(false)} style={{ borderRadius: 20, padding: 0, overflow: 'hidden' }}>
                    <Dialog.Content style={{ paddingTop: 0 }}>
                      <AddExpensesSheet
                        groupId={group.id}
                        onClose={() => setShowAddExpenseModal(false)}
                        visible={showAddExpenseModal}
                      />
                    </Dialog.Content>
                  </Dialog>
                </Portal>
              </Card.Content>
            </Card>
          </ScrollView>
        )}
        {tab === 'splits' && (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
            style={{ flex: 1 }}
          >
            <Card style={{ backgroundColor: colors.surface, borderRadius: 18, elevation: 2, marginBottom: 16 }}>
              <Card.Content>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="scale" size={22} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={{ fontWeight: 'bold', fontSize: 20, color: colors.onSurface }}>Group Splits & Settlements</Text>
                </View>
                <Text style={{ color: colors.onSurfaceVariant, marginBottom: 12 }}>Manage shared expenses and settle debts within the group.</Text>
                {splits.length === 0 ? (
                  <Text style={{ color: colors.outline, textAlign: 'center', marginVertical: 32 }}>No splits yet.</Text>
                ) : (
                  splits.map((split: SplitExpense) => (
                    <Card key={split.id} style={{
                      backgroundColor: colors.surface,
                      borderRadius: 20,
                      marginBottom: 20,
                      elevation: 6,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.12,
                      shadowRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.outline + '15'
                    }}>
                      <Card.Content style={{ padding: 24 }}>
                        {/* Header Section */}
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          marginBottom: 20,
                          paddingBottom: 16,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.outline + '20'
                        }}>
                          <View style={{
                            backgroundColor: colors.primary + '15',
                            borderRadius: 16,
                            padding: 12,
                            marginRight: 16
                          }}>
                            <Ionicons name="receipt-outline" size={28} color={colors.primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{
                              fontWeight: 'bold',
                              fontSize: 20,
                              color: colors.onSurface,
                              marginBottom: 4
                            }}>
                              {split.originalExpenseDescription}
                            </Text>
                            <Text style={{
                              color: colors.onSurfaceVariant,
                              fontSize: 14,
                              lineHeight: 20
                            }}>
                              Total: {split.currency} {split.totalAmount} • Paid by: {split.paidBy === (authUser?.uid || 'demo-user-id') ? 'You' : (group.memberDetails.find((m: any) => m.uid === split.paidBy)?.displayName || 'User')}
                            </Text>
                          </View>
                        </View>

                        {/* Participants Section */}
                        <View style={{ gap: 16 }}>
                          {split.participants.map((p: SplitParticipant, i: number) => {
                            const isCurrentUser = p.userId === (authUser?.uid || 'demo-user-id');
                            const currentUserIsPayer = split.paidBy === (authUser?.uid || 'demo-user-id');
                            const owesMoney = p.amountOwed > 0;
                            
                            return (
                              <View key={p.userId} style={{
                                backgroundColor: colors.elevation.level1,
                                borderRadius: 18,
                                padding: 20,
                                borderWidth: 1,
                                borderColor: colors.outline + '20',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.06,
                                shadowRadius: 8,
                                elevation: 3,
                              }}>
                                {/* Participant Header */}
                                <View style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  marginBottom: 16
                                }}>
                                  <View style={{
                                    backgroundColor: isCurrentUser ? colors.primary + '20' : colors.elevation.level2,
                                    borderRadius: 28,
                                    padding: 12,
                                    marginRight: 16
                                  }}>
                                    {userProfiles[p.userId]?.photoURL ? (
                                      <Avatar.Image
                                        size={32}
                                        source={{ uri: userProfiles[p.userId].photoURL }}
                                        style={{
                                          backgroundColor: isCurrentUser ? colors.primary : colors.elevation.level3
                                        }}
                                      />
                                    ) : (
                                      <Avatar.Text
                                        size={32}
                                        label={p.displayName ? p.displayName[0] : '?'}
                                        style={{
                                          backgroundColor: isCurrentUser ? colors.primary : colors.elevation.level3
                                        }}
                                      />
                                    )}
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={{
                                      fontWeight: isCurrentUser ? 'bold' : '600',
                                      fontSize: 18,
                                      color: colors.onSurface,
                                      marginBottom: 4
                                    }}>
                                      {isCurrentUser ? 'You' : p.displayName}
                                    </Text>
                                    <Text style={{
                                      color: colors.onSurfaceVariant,
                                      fontSize: 16,
                                      fontWeight: '500'
                                    }}>
                                      owes {split.currency} {p.amountOwed}
                                    </Text>
                                  </View>
                                  {/* Settled Status - Top Right Corner */}
                                  {p.settlementStatus === 'settled' && (
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
                                  {p.settlementStatus === 'pending_approval' && (
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
                                
                                {/* Action Section - Bottom Right */}
                                <View style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'flex-end'
                                }}>
                                  {p.settlementStatus === 'pending_approval' ? (
                                    currentUserIsPayer ? (
                                      <Button
                                        mode="contained"
                                        onPress={() => openApprovalModal(split, p)}
                                        disabled={isProcessingSettlement === `${split.id}-${p.userId}`}
                                        style={{
                                          borderRadius: 16,
                                          backgroundColor: colors.primary,
                                          elevation: 2,
                                          alignSelf: 'flex-end'
                                        }}
                                        contentStyle={{ paddingVertical: 6 }}
                                        labelStyle={{ fontSize: 12, fontWeight: '600' }}
                                        compact
                                        icon="eye"
                                      >
                                        Review
                                      </Button>
                                    ) : (
                                      <View style={{
                                        backgroundColor: colors.elevation.level2,
                                        borderRadius: 16,
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        flexDirection: 'row',
                                        alignItems: 'center'
                                      }}>
                                        <Ionicons name="time" size={14} color={colors.onSurfaceVariant} style={{ marginRight: 6 }} />
                                        <Text style={{ color: colors.onSurface, fontWeight: '600', fontSize: 12 }}>Waiting for approval</Text>
                                      </View>
                                    )
                                  ) : p.settlementStatus !== 'settled' && owesMoney && isCurrentUser ? (
                                    <Button
                                      mode="contained"
                                      onPress={() => openSettlementModal(split, p)}
                                      disabled={isProcessingSettlement === `${split.id}-${p.userId}`}
                                      style={{
                                        borderRadius: 20,
                                        backgroundColor: colors.primary,
                                        elevation: 2,
                                        alignSelf: 'flex-end'
                                      }}
                                      contentStyle={{ paddingVertical: 8, paddingHorizontal: 16 }}
                                      labelStyle={{ fontSize: 12, fontWeight: '600' }}
                                      compact
                                    >
                                      Settle Up
                                    </Button>
                                  ) : p.settlementStatus !== 'settled' ? (
                                    <View style={{
                                      backgroundColor: colors.elevation.level2,
                                      borderRadius: 16,
                                      paddingHorizontal: 12,
                                      paddingVertical: 6,
                                      flexDirection: 'row',
                                      alignItems: 'center'
                                    }}>
                                      <Ionicons name="alert-circle" size={14} color={colors.onSurfaceVariant} style={{ marginRight: 6 }} />
                                      <Text style={{ color: colors.onSurface, fontWeight: '600', fontSize: 12 }}>Owes</Text>
                                    </View>
                                  ) : null}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </Card.Content>
                    </Card>
                  ))
                )}
              </Card.Content>
            </Card>
          </ScrollView>
        )}
        {tab === 'members' && (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
            style={{ flex: 1 }}
          >
            <Card style={{ backgroundColor: colors.surface, borderRadius: 18, elevation: 2, marginBottom: 16 }}>
              <Card.Content>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="people-outline" size={22} color={colors.primary} style={{ marginRight: 8 }} />
                    <Text style={{ fontWeight: 'bold', fontSize: 20, color: colors.onSurface }}>Group Members</Text>
                  </View>
                  <IconButton
                    icon="account-plus"
                    size={28}
                    onPress={() => setShowAddMember(true)}
                    accessibilityLabel="Add Member"
                    iconColor={colors.primary}
                    style={{ marginRight: -8 }}
                  />
                </View>
                <Text style={{ color: colors.onSurfaceVariant, marginBottom: 16 }}>Manage group members and their roles.</Text>
                {group.memberDetails.length === 0 ? (
                  <Text style={{ color: colors.outline, textAlign: 'left', marginVertical: 32 }}>No members found.</Text>
                ) : (
                  group.memberDetails.map((member: any) => {
                    const isCurrentUser = userProfile?.uid === member.uid;
                    const isCurrentUserAdmin = group.memberDetails.find((m: any) => m.uid === userProfile?.uid)?.role === 'admin' || group.memberDetails.find((m: any) => m.uid === userProfile?.uid)?.role === 'creator';
                    const isCurrentUserCreator = group.memberDetails.find((m: any) => m.uid === userProfile?.uid)?.role === 'creator';
                    const handlePromote = async () => {
                      setLoadingAction(v => ({ ...v, [member.uid]: true }));
                      try {
                        await updateMemberRole(group.id, userProfile, member.uid, 'admin');
                        setMenuVisible(v => ({ ...v, [member.uid]: false }));
                        const updated = await getGroupDetails(group.id);
                        setGroup(updated);
                      } catch (e) { Alert.alert('Error', 'Failed to promote member.'); }
                      setLoadingAction(v => ({ ...v, [member.uid]: false }));
                    };
                    const handleDemote = async () => {
                      setLoadingAction(v => ({ ...v, [member.uid]: true }));
                      try {
                        await updateMemberRole(group.id, userProfile, member.uid, 'member');
                        setMenuVisible(v => ({ ...v, [member.uid]: false }));
                        const updated = await getGroupDetails(group.id);
                        setGroup(updated);
                      } catch (e) { Alert.alert('Error', 'Failed to demote member.'); }
                      setLoadingAction(v => ({ ...v, [member.uid]: false }));
                    };
                    const handleTransfer = async () => {
                      setLoadingAction(v => ({ ...v, [member.uid]: true }));
                      try {
                        await transferGroupOwnership(group.id, userProfile, member.uid);
                        setMenuVisible(v => ({ ...v, [member.uid]: false }));
                        const updated = await getGroupDetails(group.id);
                        setGroup(updated);
                      } catch (e) { Alert.alert('Error', 'Failed to transfer ownership.'); }
                      setLoadingAction(v => ({ ...v, [member.uid]: false }));
                    };
                    const handleRemove = async () => {
                      setLoadingAction(v => ({ ...v, [member.uid]: true }));
                      try {
                        await removeMemberFromGroup(group.id, userProfile, member.uid, member.displayName);
                        setMenuVisible(v => ({ ...v, [member.uid]: false }));
                        const updated = await getGroupDetails(group.id);
                        setGroup(updated);
                      } catch (e) { Alert.alert('Error', 'Failed to remove member.'); }
                      setLoadingAction(v => ({ ...v, [member.uid]: false }));
                    };
                    return (
                      <View key={member.uid} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.elevation.level1, borderRadius: 12, padding: 12, marginBottom: 12, justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <Avatar.Text size={40} label={member.displayName ? member.displayName[0] : '?'} style={{ marginRight: 14, backgroundColor: colors.elevation.level2 }} />
                          <View>
                            <Text style={{ fontWeight: 'bold', fontSize: 16, color: colors.onSurface }}>{member.displayName}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                              {member.role === 'creator' && <Ionicons name="star" size={16} color="#fbbf24" style={{ marginRight: 4 }} />}
                              <Text style={{ color: colors.onSurfaceVariant, fontSize: 14 }}>{member.role.charAt(0).toUpperCase() + member.role.slice(1)}</Text>
                            </View>
                          </View>
                        </View>
                        {!isCurrentUser && isCurrentUserAdmin && (
                          <Menu
                            visible={!!menuVisible[member.uid]}
                            onDismiss={() => setMenuVisible(v => ({ ...v, [member.uid]: false }))}
                            anchor={<IconButton icon="dots-horizontal" size={24} onPress={() => setMenuVisible(v => ({ ...v, [member.uid]: true }))} />}
                          >
                            {member.role === 'member' && <Menu.Item onPress={handlePromote} title={loadingAction[member.uid] ? 'Promoting...' : 'Promote to Admin'} disabled={!!loadingAction[member.uid]} />}
                            {member.role === 'admin' && isCurrentUserCreator && <Menu.Item onPress={handleDemote} title={loadingAction[member.uid] ? 'Demoting...' : 'Demote to Member'} disabled={!!loadingAction[member.uid]} />}
                            {isCurrentUserCreator && member.role === 'admin' && <Menu.Item onPress={handleTransfer} title={loadingAction[member.uid] ? 'Transferring...' : 'Transfer Ownership'} disabled={!!loadingAction[member.uid]} />}
                            <Menu.Item onPress={handleRemove} title={loadingAction[member.uid] ? 'Removing...' : 'Remove from Group'} disabled={!!loadingAction[member.uid]} />
                          </Menu>
                        )}
                      </View>
                    );
                  })
                )}
              </Card.Content>
            </Card>
          </ScrollView>
        )}
        {tab === 'activity' && (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
            style={{ flex: 1 }}
          >
            <Card style={{ marginBottom: 16, backgroundColor: colors.elevation.level1 }}>
              <Card.Title title="Group Activity" left={props => <Avatar.Icon {...props} icon="history" />} right={props => <Tooltip title="Recent group actions."><IconButton icon="information" /></Tooltip>} />
              <Divider />
              {activityLoading ? (
                <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator animating color={colors.primary} size="small" /><Text>Loading activity...</Text></View>
              ) : (
                <List.Section>
                  {activityLog.length === 0 ? (
                    <Text style={{ padding: 16, color: colors.onSurfaceVariant }}>No activity recorded for this group yet.</Text>
                  ) : activityLog.map(log => (
                    <List.Item
                      key={log.id}
                      title={log.details}
                      description={`${log.actorDisplayName} • ${new Date(log.timestamp).toLocaleString()}`}
                      left={props => <Avatar.Text {...props} label={log.actorDisplayName ? log.actorDisplayName[0] : '?'} />}
                    />
                  ))}
                </List.Section>
              )}
            </Card>
          </ScrollView>
        )}
        {tab === 'chat' && (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
            style={{ flex: 1 }}
          >
            <Card style={{ marginBottom: 16, backgroundColor: colors.elevation.level1, minHeight: 320, borderRadius: 18, elevation: 2 }}>
              <Card.Title title="Group Chat" left={props => <Avatar.Icon {...props} icon="chat" />} right={props => <Tooltip title="Chat with group members."><IconButton icon="information" /></Tooltip>} />
              <Divider />
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView ref={chatScrollRef} style={{ maxHeight: 300, minHeight: 200 }} contentContainerStyle={{ padding: 8 }}>
                  {chatMessages.length === 0 ? (
                    <Text style={{ color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 32 }}>No messages yet. Start the conversation!</Text>
                  ) : chatMessages.map(msg => {
                    const isSender = msg.userId === authUser?.uid;
                    return (
                      <View key={msg.id} style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, justifyContent: isSender ? 'flex-end' : 'flex-start' }}>
                        {!isSender && <Avatar.Text size={32} label={msg.userDisplayName ? msg.userDisplayName[0] : '?'} style={{ marginRight: 8, backgroundColor: colors.elevation.level2 }} />}
                        <View style={{
                          backgroundColor: isSender ? colors.primary : colors.elevation.level2,
                          borderRadius: 16,
                          padding: 10,
                          maxWidth: '80%',
                          shadowColor: '#000',
                          shadowOpacity: 0.08,
                          shadowRadius: 4,
                          elevation: 2,
                        }}>
                          {!isSender && <Text style={{ fontWeight: 'bold', color: colors.onSurface, fontSize: 13, marginBottom: 2 }}>{msg.userDisplayName}</Text>}
                          <Text style={{ color: isSender ? colors.onPrimary : colors.onSurface, fontSize: 15 }}>{msg.text}</Text>
                          <Text style={{ fontSize: 10, color: isSender ? colors.onPrimary : colors.onSurfaceVariant, marginTop: 2, textAlign: 'right' }}>{new Date(msg.createdAt).toLocaleString()}</Text>
                        </View>
                        {isSender && <Avatar.Text size={32} label={msg.userDisplayName ? msg.userDisplayName[0] : '?'} style={{ marginLeft: 8, backgroundColor: colors.primary }} />}
                      </View>
                    );
                  })}
                </ScrollView>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingHorizontal: 8, paddingBottom: 8 }}>
                  <TextInput
                    value={chatInput}
                    onChangeText={setChatInput}
                    placeholder="Type a message..."
                    style={{ flex: 1, marginRight: 8, backgroundColor: colors.elevation.level2, borderRadius: 10, minHeight: 44, paddingVertical: 8 }}
                    mode="outlined"
                    disabled={sendingChat}
                    theme={{ colors: { background: colors.elevation.level2 } }}
                  />
                  <Button
                    mode="contained"
                    onPress={handleSendChat}
                    loading={sendingChat}
                    disabled={!chatInput.trim()}
                    icon="send"
                    style={{ borderRadius: 10, backgroundColor: colors.primary, minWidth: 48, height: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 0 }}
                    labelStyle={{ color: colors.onPrimary, fontSize: 18 }}
                    contentStyle={{ height: 44 }}
                  >
                    {''}
                  </Button>
                </View>
              </KeyboardAvoidingView>
            </Card>
          </ScrollView>
        )}
        {tab === 'savings' && (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
            style={{ flex: 1 }}
          >
            <Card style={{ backgroundColor: colors.surface, borderRadius: 18, elevation: 2, marginBottom: 16 }}>
              <Card.Content>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="wallet-outline" size={22} color={colors.primary} style={{ marginRight: 8 }} />
                    <Text style={{ fontWeight: 'bold', fontSize: 20, color: colors.onSurface }}>Group Savings Goals</Text>
                  </View>
                  <IconButton
                    icon="plus"
                    size={28}
                    onPress={() => setShowAddGoal(true)}
                    accessibilityLabel="Add Goal"
                    iconColor={colors.primary}
                    style={{ marginRight: -8 }}
                  />
                </View>
                <Text style={{ color: colors.onSurfaceVariant, marginBottom: 16 }}>Work together towards a common financial target.</Text>
                {savingsLoading ? <ActivityIndicator /> : (
                  savingsGoals.length === 0 ? (
                    <Text style={{ color: colors.outline, textAlign: 'left', marginVertical: 32 }}>No savings goals set for this group yet.</Text>
                  ) : (
                    savingsGoals.map(goal => {
                      // Optionally, add a progress bar if you have currentAmount
                      const progress = goal.currentAmount && goal.targetAmount ? Math.min(goal.currentAmount / goal.targetAmount, 1) : 0;
                      return (
                        <Card key={goal.id} style={{ backgroundColor: colors.elevation.level1, borderRadius: 14, padding: 0, marginBottom: 14, elevation: 1 }}>
                          <Card.Content style={{ padding: 14 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                              <Text style={{ fontWeight: 'bold', fontSize: 16, color: colors.onSurface }}>{goal.name}</Text>
                              <IconButton icon="plus-circle" size={24} onPress={() => openContributionModal(goal)} accessibilityLabel="Contribute to Goal" iconColor={colors.primary} />
                            </View>
                            <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 15, marginBottom: 4 }}>Target: {goal.currency} {goal.targetAmount}</Text>
                            {goal.currentAmount !== undefined && (
                              <View style={{ marginBottom: 6 }}>
                                <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.elevation.level2, overflow: 'hidden' }}>
                                  <View style={{ width: `${goal.currentAmount / goal.targetAmount * 100}%`, height: 8, backgroundColor: colors.primary, borderRadius: 4 }} />
                                </View>
                                <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 }}>{goal.currency} {goal.currentAmount} saved</Text>
                              </View>
                            )}
                            <Text style={{ color: colors.onSurfaceVariant, fontSize: 13 }}>Created by: <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{goal.createdBy?.displayName || 'User'}</Text> on {goal.createdAt ? new Date(goal.createdAt).toLocaleDateString() : ''}</Text>
                            {/* Leaderboard & Recent Contributions */}
                            {goalContributions[goal.id] && goalContributions[goal.id].length > 0 && (
                              <View style={{ marginTop: 12 }}>
                                {/* Leaderboard */}
                                <Text style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 4 }}>Leaderboard</Text>
                                {Object.entries(goalContributions[goal.id].reduce((acc, c) => {
                                  acc[c.userDisplayName] = (acc[c.userDisplayName] || 0) + c.amount;
                                  return acc;
                                }, {} as Record<string, number>)).sort(([,a],[,b]) => Number(b as number)-Number(a as number)).slice(0, 3).map(([name, amount], i) => (
                                  <Text key={name} style={{ fontSize: 14, color: i === 0 ? '#fbbf24' : colors.onSurface, fontWeight: i === 0 ? 'bold' : 'normal' }}>{i+1}. {name}: {goal.currency} {Number(amount as number).toFixed(2)}</Text>
                                ))}
                                {/* Recent Contributions */}
                                <Text style={{ fontWeight: 'bold', fontSize: 15, marginTop: 8, marginBottom: 4 }}>Recent Contributions</Text>
                                {goalContributions[goal.id].slice(0, 5).map((c, i) => (
                                  <Text key={c.id} style={{ fontSize: 13, color: colors.onSurfaceVariant }}>{c.userDisplayName}: {goal.currency} {c.amount.toFixed(2)} {c.notes ? `- ${c.notes}` : ''}</Text>
                                ))}
                              </View>
                            )}
                          </Card.Content>
                        </Card>
                      );
                    })
                  )
                )}
              </Card.Content>
            </Card>
            <Portal>
              <Dialog visible={showAddGoal} onDismiss={() => setShowAddGoal(false)}>
                <Dialog.Title>Add Savings Goal</Dialog.Title>
                <Dialog.Content>
                  <TextInput
                    label="Goal Name"
                    value={goalName}
                    onChangeText={setGoalName}
                    mode="outlined"
                    style={{ marginBottom: 12 }}
                  />
                  <TextInput
                    label="Target Amount"
                    value={goalAmount}
                    onChangeText={setGoalAmount}
                    keyboardType="numeric"
                    mode="outlined"
                    style={{ marginBottom: 12 }}
                  />
                  <TextInput
                    label="Currency"
                    value={goalCurrency}
                    onChangeText={setGoalCurrency}
                    mode="outlined"
                    style={{ marginBottom: 12 }}
                  />
                </Dialog.Content>
                <Dialog.Actions>
                  <GroupButton onPress={() => setShowAddGoal(false)}>Cancel</GroupButton>
                  <GroupButton loading={addingGoal} onPress={handleAddGoal}>Add</GroupButton>
                </Dialog.Actions>
              </Dialog>
            </Portal>
            <Portal>
              <Dialog visible={contributionModal.open} onDismiss={closeContributionModal}>
                <Dialog.Title>Contribute to {contributionModal.goal?.name}</Dialog.Title>
                <Dialog.Content>
                  <TextInput
                    label="Amount"
                    value={contributionAmount}
                    onChangeText={setContributionAmount}
                    keyboardType="decimal-pad"
                    mode="outlined"
                    style={{ marginBottom: 12 }}
                  />
                  <TextInput
                    label="Notes (optional)"
                    value={contributionNotes}
                    onChangeText={setContributionNotes}
                    mode="outlined"
                    style={{ marginBottom: 12 }}
                  />
                  {contributionError ? <Text style={{ color: colors.error, marginBottom: 8 }}>{contributionError}</Text> : null}
                </Dialog.Content>
                <Dialog.Actions>
                  <Button onPress={closeContributionModal}>Cancel</Button>
                  <Button loading={contributionLoading} onPress={handleAddContribution}>Contribute</Button>
                </Dialog.Actions>
              </Dialog>
            </Portal>
          </ScrollView>
        )}
      </View>
      <Portal>
        <Dialog visible={showAddMember} onDismiss={() => setShowAddMember(false)} style={{ borderRadius: 20, padding: 0, overflow: 'hidden' }}>
          <Dialog.Title style={{ fontWeight: 'bold', fontSize: 20, marginBottom: 0, paddingBottom: 0 }}>Add Members to {group?.name}</Dialog.Title>
          <Dialog.Content style={{ paddingTop: 0 }}>
            <Text style={{ color: colors.onSurfaceVariant, marginBottom: 16, fontSize: 15 }}>Add existing friends or invite new users by email.</Text>
            {/* Tabs */}
            <View style={{ marginTop: 8, marginBottom: 8 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ height: 44, backgroundColor: 'transparent' }}
                contentContainerStyle={{ alignItems: 'center' }}
              >
                <View style={{
                  flexDirection: 'row',
                  backgroundColor: dark ? colors.elevation.level1 : '#f3f4f6',
                  borderRadius: 8,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: dark ? colors.outline : '#e5e7eb',
                  minHeight: 44,
                  alignItems: 'center',
                }}>
                  {['friends', 'email', 'phone', 'link'].map(tabKey => (
                    <TouchableOpacity
                      key={tabKey}
                      style={{
                        minWidth: 110,
                        flexShrink: 1,
                        paddingVertical: 10,
                        borderRadius: 8,
                        backgroundColor: addMemberTab === tabKey ? (dark ? colors.background : '#fff') : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onPress={() => setAddMemberTab(tabKey as any)}
                    >
                      <Text style={{
                        fontSize: 16,
                        fontWeight: addMemberTab === tabKey ? '700' : '400',
                        color: addMemberTab === tabKey ? colors.onBackground : colors.onSurfaceVariant,
                        textAlign: 'center',
                      }}>
                        {tabKey === 'friends' ? 'From Friends' : tabKey === 'email' ? 'By Email' : tabKey === 'phone' ? 'By Phone' : 'By Link'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
            {/* Tab Content */}
            {addMemberTab === 'friends' && (
              friendsNotInGroup.length === 0 ? (
                <View style={{ padding: 32, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors.onSurfaceVariant, fontSize: 16, textAlign: 'center' }}>All your friends are already in this group.</Text>
                </View>
              ) : (
                <View style={{ borderWidth: 1, borderColor: colors.outline, borderRadius: 12, backgroundColor: colors.background, padding: 4, marginBottom: 8 }}>
                  <ScrollView style={{ maxHeight: 220 }}>
                    {friendsNotInGroup.map(friend => (
                      <TouchableOpacity key={friend.uid || friend.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, backgroundColor: selectedFriends[friend.uid || friend.id] ? colors.elevation.level1 : 'transparent', marginBottom: 6 }} onPress={() => setSelectedFriends(v => ({ ...v, [friend.uid || friend.id]: !v[friend.uid || friend.id] }))}>
                        <Avatar.Text size={34} label={friend.displayName ? friend.displayName[0] : '?'} style={{ marginRight: 14, backgroundColor: colors.elevation.level2 }} />
                        <Text style={{ flex: 1, fontSize: 16 }}>{friend.displayName || friend.email}</Text>
                        <Checkbox status={selectedFriends[friend.uid || friend.id] ? 'checked' : 'unchecked'} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <GroupButton
                    onPress={handleAddSelectedFriends}
                    loading={addingFriends}
                    disabled={Object.values(selectedFriends).every(v => !v)}
                  >
                    Add Selected Friends
                  </GroupButton>
                </View>
              )
            )}
            {addMemberTab === 'email' && (
              <View>
                <TextInput
                  label="Email"
                  value={emailInput}
                  onChangeText={setEmailInput}
                  onBlur={validateEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={{ marginBottom: 12, borderRadius: 8, fontSize: 16 }}
                  mode="outlined"
                />
                {emailStatus === 'valid' && <Text style={{ color: 'green', marginBottom: 8, fontSize: 15 }}>User found: {emailUser?.displayName || emailUser?.email}</Text>}
                {emailStatus === 'invalid' && <Text style={{ color: 'red', marginBottom: 8, fontSize: 15 }}>No user found with this email.</Text>}
                {emailStatus === 'error' && <Text style={{ color: 'red', marginBottom: 8, fontSize: 15 }}>Error checking email.</Text>}
                <GroupButton onPress={handleAddByEmail} loading={addingByEmail} disabled={emailStatus !== 'valid'}>
                  Add by Email
                </GroupButton>
              </View>
            )}
            {addMemberTab === 'phone' && (
              <View>
                <TextInput
                  label="Phone Number"
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  onBlur={validatePhone}
                  keyboardType="phone-pad"
                  style={{ marginBottom: 12, borderRadius: 8, fontSize: 16 }}
                  mode="outlined"
                />
                {phoneStatus === 'valid' && <Text style={{ color: 'green', marginBottom: 8, fontSize: 15 }}>User found: {phoneUser?.displayName || phoneUser?.phoneNumber}</Text>}
                {phoneStatus === 'invalid' && <Text style={{ color: 'red', marginBottom: 8, fontSize: 15 }}>No user found with this phone number.</Text>}
                {phoneStatus === 'error' && <Text style={{ color: 'red', marginBottom: 8, fontSize: 15 }}>Error checking phone number.</Text>}
                <GroupButton onPress={handleAddByPhone} loading={addingByPhone} disabled={phoneStatus !== 'valid'}>
                  Add by Phone
                </GroupButton>
              </View>
            )}
            {addMemberTab === 'link' && (
              <View>
                <GroupButton onPress={handleGenerateInviteLink} loading={generatingLink}>
                  Generate Invite Link
                </GroupButton>
                {inviteLink ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.elevation.level2, borderRadius: 8, padding: 8 }}>
                    <Text style={{ flex: 1, fontSize: 15 }}>{inviteLink}</Text>
                    <Button mode="text" onPress={() => Clipboard.setString(inviteLink)} style={{ marginLeft: 8 }}>Copy</Button>
                  </View>
                ) : null}
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions style={{ paddingBottom: 12, paddingRight: 16 }}>
            <GroupButton onPress={() => setShowAddMember(false)}>Close</GroupButton>
          </Dialog.Actions>
          <Snackbar
            visible={snackbar.visible}
            onDismiss={() => setSnackbar({ visible: false, message: '' })}
            duration={2500}
            style={{ backgroundColor: snackbar.color || colors.primary }}
          >
            {snackbar.message}
          </Snackbar>
        </Dialog>
        <Dialog visible={!!memberToRemove} onDismiss={() => setMemberToRemove(null)}>
          <Dialog.Title>Remove Member</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to remove {memberToRemove?.displayName} from the group?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <GroupButton onPress={() => setMemberToRemove(null)}>Cancel</GroupButton>
            <GroupButton loading={removingMember} onPress={handleRemoveMember}>
              Remove
            </GroupButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog visible={showEditGroupModal} onDismiss={() => setShowEditGroupModal(false)}>
          <Dialog.Title>Edit Group</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Group Name"
              value={editGroupName}
              onChangeText={setEditGroupName}
              mode="outlined"
              style={{ marginBottom: 16 }}
            />
            <Button mode="outlined" onPress={handlePickImage} style={{ marginBottom: 12 }}>
              {editGroupImage ? 'Change Group Image' : 'Upload Group Image'}
            </Button>
            {editGroupImage ? (
              <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <Avatar.Image source={{ uri: editGroupImage }} size={80} />
              </View>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowEditGroupModal(false)}>Cancel</Button>
            <Button loading={editGroupLoading} onPress={handleSaveGroupEdit} disabled={!editGroupName.trim()}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      {/* FABs for Add Member and Split Expense */}
      {/* <FAB
        icon="account-plus"
        style={{ position: 'absolute', right: 16, bottom: 96, backgroundColor: colors.primary }}
        color={colors.onPrimary}
        onPress={() => setShowAddMember(true)}
        visible
        label="Add Member"
      />
      <FAB
        icon="scale-balance"
        style={{ position: 'absolute', right: 16, bottom: 32, backgroundColor: colors.secondary }}
        color={colors.onPrimary}
        onPress={handleSplitExpense}
        visible
        label="Split Expense"
      /> */}

        {/* Settlement Modal */}
        <Portal>
          <Dialog visible={settlementModal.open} onDismiss={closeSettlementModal} style={{ borderRadius: 24 }}>
            <Dialog.Title style={{ 
              fontWeight: 'bold', 
              fontSize: 24, 
              textAlign: 'center', 
              marginBottom: 12, 
              color: colors.primary 
            }}>
              Settle Your Debt
            </Dialog.Title>
            <Dialog.Content style={{ paddingHorizontal: 28, paddingTop: 0 }}>
              <Text style={{ 
                color: colors.onSurfaceVariant, 
                fontSize: 17, 
                marginBottom: 24,
                textAlign: 'center',
                lineHeight: 24
              }}>
                Choose how you want to settle your debt of{' '}
                <Text style={{ fontWeight: 'bold', color: colors.primary, fontSize: 20 }}>
                  {settlementModal.split?.currency} {settlementModal.participant?.amountOwed}
                </Text>
                {' '}with{' '}
                <Text style={{ fontWeight: '600', color: colors.onSurface }}>
                  {settlementModal.split?.participants.find(p => p.userId === settlementModal.split?.paidBy)?.displayName || 'the payer'}
                </Text>
              </Text>
              
              <View style={{ gap: 20 }}>
                <Button 
                  mode="contained" 
                  onPress={() => {
                    if (settlementModal.split && settlementModal.participant) {
                      handleSettleWithWallet(
                        settlementModal.split.id!, 
                        settlementModal.participant.userId, 
                        settlementModal.participant.amountOwed, 
                        settlementModal.split.currency
                      );
                      closeSettlementModal();
                    }
                  }}
                  disabled={isProcessingSettlement === `${settlementModal.split?.id}-${settlementModal.participant?.userId}`}
                  style={{ 
                    borderRadius: 20, 
                    backgroundColor: colors.primary,
                    elevation: 4
                  }}
                  contentStyle={{ paddingVertical: 16 }}
                  labelStyle={{ fontSize: 17, fontWeight: '600' }}
                  icon="wallet"
                >
                  {isProcessingSettlement === `${settlementModal.split?.id}-${settlementModal.participant?.userId}` ? 'Processing...' : 'Pay with Wallet'}
                </Button>
                
                <Button 
                  mode="outlined" 
                  onPress={() => {
                    if (settlementModal.split) {
                      handleRequestManualSettlement(settlementModal.split.id!);
                      closeSettlementModal();
                    }
                  }}
                  disabled={isProcessingSettlement === settlementModal.split?.id}
                  loading={isProcessingSettlement === settlementModal.split?.id}
                  style={{ 
                    borderRadius: 20, 
                    borderColor: colors.outline,
                    borderWidth: 2,
                    elevation: 2
                  }}
                  contentStyle={{ paddingVertical: 16 }}
                  labelStyle={{ fontSize: 17, fontWeight: '600' }}
                  icon="handshake"
                >
                  {isProcessingSettlement === settlementModal.split?.id ? 'Processing...' : 'I Paid Manually'}
                </Button>
                
                <View style={{ 
                  backgroundColor: colors.elevation.level1, 
                  borderRadius: 16, 
                  padding: 20,
                  marginTop: 8
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ 
                      backgroundColor: colors.primary + '20', 
                      borderRadius: 12, 
                      padding: 8, 
                      marginRight: 12 
                    }}>
                      <Text style={{ color: colors.primary, fontSize: 18 }}>💡</Text>
                    </View>
                    <Text style={{ 
                      fontWeight: '600', 
                      fontSize: 16, 
                      color: colors.onSurface 
                    }}>
                      What's the difference?
                    </Text>
                  </View>
                  <Text style={{ 
                    color: colors.onSurfaceVariant, 
                    fontSize: 14, 
                    lineHeight: 20 
                  }}>
                    <Text style={{ fontWeight: '600' }}>Pay with Wallet:</Text> Instant settlement using your wallet funds.{'\n\n'}
                    <Text style={{ fontWeight: '600' }}>I Paid Manually:</Text> Notify the payer to confirm they received your payment outside the app.
                  </Text>
                </View>
              </View>
            </Dialog.Content>
            <Dialog.Actions style={{ paddingHorizontal: 28, paddingBottom: 28 }}>
              <Button 
                mode="text" 
                onPress={closeSettlementModal}
                style={{ borderRadius: 16 }}
                labelStyle={{ fontSize: 17, fontWeight: '600' }}
              >
                Cancel
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Approval Modal */}
        <Portal>
          <Dialog visible={approvalModal.open} onDismiss={closeApprovalModal} style={{ borderRadius: 24 }}>
            <Dialog.Title style={{ 
              fontWeight: 'bold', 
              fontSize: 22, 
              textAlign: 'center',
              marginBottom: 8,
              color: colors.primary
            }}>
              Approve Manual Settlement?
            </Dialog.Title>
            <Dialog.Content style={{ paddingHorizontal: 28, paddingTop: 0 }}>
              <Text style={{ 
                color: colors.onSurfaceVariant, 
                fontSize: 16, 
                marginBottom: 24,
                textAlign: 'center',
                lineHeight: 22
              }}>
                {approvalModal.participant?.displayName || 'A participant'} has claimed they paid you{' '}
                <Text style={{ fontWeight: 'bold', color: colors.primary, fontSize: 18 }}>
                  {approvalModal.split?.currency} {approvalModal.participant?.amountOwed}
                </Text>
                {' '}outside the app. Do you approve this settlement?
              </Text>
            </Dialog.Content>
            <Dialog.Actions style={{ paddingHorizontal: 28, paddingBottom: 28, gap: 12 }}>
              <Button 
                mode="outlined" 
                onPress={() => {
                  if (approvalModal.split && approvalModal.participant) {
                    handleRejectSettlement(approvalModal.split.id!, approvalModal.participant.userId);
                    closeApprovalModal();
                  }
                }}
                disabled={isProcessingSettlement === `${approvalModal.split?.id}-${approvalModal.participant?.userId}`}
                style={{ 
                  borderColor: colors.error,
                  borderRadius: 20,
                  borderWidth: 2,
                  flex: 1
                }}
                textColor={colors.error}
                loading={isProcessingSettlement === `${approvalModal.split?.id}-${approvalModal.participant?.userId}`}
                contentStyle={{ paddingVertical: 12 }}
                labelStyle={{ fontSize: 15, fontWeight: '600' }}
              >
                {isProcessingSettlement === `${approvalModal.split?.id}-${approvalModal.participant?.userId}` ? 'Rejecting...' : 'Reject'}
              </Button>
              <Button 
                mode="contained" 
                onPress={() => {
                  if (approvalModal.split && approvalModal.participant) {
                    handleApproveSettlement(approvalModal.split.id!, approvalModal.participant.userId);
                    closeApprovalModal();
                  }
                }}
                disabled={isProcessingSettlement === `${approvalModal.split?.id}-${approvalModal.participant?.userId}`}
                loading={isProcessingSettlement === `${approvalModal.split?.id}-${approvalModal.participant?.userId}`}
                style={{ 
                  borderRadius: 20,
                  backgroundColor: colors.primary,
                  elevation: 3,
                  flex: 1
                }}
                contentStyle={{ paddingVertical: 12 }}
                labelStyle={{ fontSize: 15, fontWeight: '600' }}
              >
                {isProcessingSettlement === `${approvalModal.split?.id}-${approvalModal.participant?.userId}` ? 'Approving...' : 'Approve'}
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
    </Surface>
  );
} 