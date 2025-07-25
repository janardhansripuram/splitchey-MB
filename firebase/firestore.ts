import * as Notifications from 'expo-notifications';
import { updateProfile } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, limit, onSnapshot, orderBy, query, runTransaction, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from './config';

// Basic types (expand as needed)
export type Group = {
  id: string;
  name: string;
  createdBy: string;
  memberIds: string[];
  memberDetails: any[];
  imageUrl?: string;
  createdAt: string;
  updatedAt?: string;
};

export type Expense = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  notes?: string;
  groupId?: string;
  groupName?: string;
  createdAt: string;
  userId: string;
  paidById: string;
  paidByName: string;
};

export type SplitParticipant = {
  userId: string;
  displayName: string;
  email: string;
  amountOwed: number;
  settlementStatus: 'settled' | 'unsettled' | 'pending';
  percentage?: number;
};

export type SplitExpense = {
  id: string;
  originalExpenseId: string;
  originalExpenseDescription: string;
  currency: string;
  splitMethod: 'equally' | 'byAmount' | 'byPercentage';
  totalAmount: number;
  paidBy: string;
  participants: SplitParticipant[];
  involvedUserIds: string[];
  groupId?: string;
  groupName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type GroupActivityLogEntry = {
  id: string;
  actorId: string;
  actorDisplayName: string;
  actionType: string;
  details: string;
  timestamp: string;
};

export type ChatMessage = {
  id: string;
  groupId: string;
  userId: string;
  userDisplayName: string;
  userAvatarUrl?: string;
  text: string;
  createdAt: string;
};

export type Income = {
  id: string;
  source: string;
  amount: number;
  currency: string;
  date: string;
  notes?: string;
  createdAt: string;
  userId: string;
};

// TODO: Define types Expense, Friend, Group, SplitExpense as needed

export async function getRecentExpensesByUser(userId: string, count: number = 5) {
  if (!userId) return [];
  // For simplicity, just get all and slice (optimize later)
  const expensesRef = collection(db, 'expenses');
  const q = query(expensesRef, where('userId', '==', userId), orderBy('date', 'desc'));
  const querySnapshot = await getDocs(q);
  const expenses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return expenses.slice(0, count);
}

// Fetch friends from users/{userId}/friends subcollection (web logic)
export async function getFriends(userId: string) {
  if (!userId) return [];
  const friendsRef = collection(db, 'users', userId, 'friends');
  const q = query(friendsRef, orderBy('displayName', 'asc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
}

// Fetch groups where memberIds contains userId (web logic)
export async function getGroupsForUser(userId: string) {
  if (!userId) return [];
  const groupsRef = collection(db, 'groups');
  const q = query(groupsRef, where('memberIds', 'array-contains', userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Fetch all splits where involvedUserIds contains userId (web logic)
export async function getSplitExpensesForUser(userId: string) {
  if (!userId) return [];
  const splitsRef = collection(db, 'split_expenses');
  const q = query(splitsRef, where('involvedUserIds', 'array-contains', userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getGroupDetails(groupId: string): Promise<Group | null> {
  if (!groupId) return null;
  const groupRef = doc(db, 'groups', groupId);
  const docSnap = await getDoc(groupRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name,
      createdBy: data.createdBy,
      memberIds: data.memberIds || [],
      memberDetails: data.memberDetails || [],
      imageUrl: data.imageUrl || undefined,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : '',
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : undefined,
    };
  }
  return null;
}

export async function getExpensesByGroupId(groupId: string): Promise<Expense[]> {
  if (!groupId) return [];
  const q = query(
    collection(db, 'expenses'),
    where('groupId', '==', groupId),
    orderBy('date', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      description: data.description || 'No description',
      amount: typeof data.amount === 'number' ? data.amount : 0,
      currency: data.currency || 'USD',
      category: data.category || 'Other',
      date: data.date?.toDate ? data.date.toDate().toISOString().split('T')[0] : '',
      notes: data.notes || '',
      groupId: data.groupId || undefined,
      groupName: data.groupName || undefined,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : '',
      userId: data.userId || 'Unknown User',
      paidById: data.paidById || data.userId || 'Unknown User',
      paidByName: data.paidByName || 'Unknown Payer',
    };
  });
}

export async function getSplitExpensesByGroupId(groupId: string): Promise<SplitExpense[]> {
  if (!groupId) return [];
  const q = query(
    collection(db, 'split_expenses'),
    where('groupId', '==', groupId),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      originalExpenseId: data.originalExpenseId,
      originalExpenseDescription: data.originalExpenseDescription,
      currency: data.currency || 'USD',
      splitMethod: data.splitMethod,
      totalAmount: data.totalAmount,
      paidBy: data.paidBy,
      participants: data.participants || [],
      involvedUserIds: data.involvedUserIds || [],
      groupId: data.groupId || undefined,
      groupName: data.groupName || undefined,
      notes: data.notes || '',
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : '',
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : '',
    };
  });
}

export async function createSplitExpense(splitData: Omit<SplitExpense, 'id' | 'createdAt' | 'updatedAt'> & { actorProfile?: any }): Promise<string> {
  // This is a simplified version; expand as needed for validation
  const dataToSave = {
    ...splitData,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const docRef = await addDoc(collection(db, 'split_expenses'), dataToSave);
  return docRef.id;
}

export async function settleDebtWithWallet(splitId: string, settlingUserId: string): Promise<void> {
  // Minimal wallet logic for demo; expand as needed
  return runTransaction(db, async (transaction) => {
    const splitRef = doc(db, 'split_expenses', splitId);
    const splitDoc = await transaction.get(splitRef);
    if (!splitDoc.exists()) throw new Error('Split expense not found.');
    const splitData = splitDoc.data() as SplitExpense;
    const currency = splitData.currency;
    const payerId = splitData.paidBy;
    const settlerRef = doc(db, 'users', settlingUserId);
    const payerRef = doc(db, 'users', payerId);
    const settlerDoc = await transaction.get(settlerRef);
    const payerDoc = await transaction.get(payerRef);
    if (!settlerDoc.exists()) throw new Error('Your user profile was not found.');
    if (!payerDoc.exists()) throw new Error("The payer's user profile could not be found.");
    const participant = splitData.participants.find(p => p.userId === settlingUserId);
    if (!participant) throw new Error('You are not a participant in this split.');
    if (participant.settlementStatus !== 'unsettled') throw new Error('This debt is either already settled or pending approval.');
    const amountToSettle = participant.amountOwed;
    const settlerWallet = settlerDoc.data().wallet || {};
    const settlerBalance = settlerWallet[currency] || 0;
    if (settlerBalance < amountToSettle) throw new Error(`Insufficient funds in your ${currency} wallet. You have ${settlerBalance}, but need ${amountToSettle}.`);
    transaction.update(settlerRef, { [`wallet.${currency}`]: increment(-amountToSettle) });
    transaction.update(payerRef, { [`wallet.${currency}`]: increment(amountToSettle) });
    const updatedParticipants = splitData.participants.map(p =>
      p.userId === settlingUserId ? { ...p, settlementStatus: 'settled' } : p
    );
    transaction.update(splitRef, { participants: updatedParticipants });
  });
}

export async function updateSplitExpense(
  splitExpenseId: string,
  updates: {
    totalAmount: number;
    payerId: string;
    participants: { userId: string; amountOwed?: number; percentage?: number }[];
    splitMethod: 'equally' | 'byAmount' | 'byPercentage';
    notes?: string;
  },
  // Optionally pass actorProfile for logging
): Promise<void> {
  const splitRef = doc(db, 'split_expenses', splitExpenseId);
  // For simplicity, just update the split doc (no logging or expense update)
  const splitDoc = await getDoc(splitRef);
  if (!splitDoc.exists()) throw new Error('Split expense not found for update.');
  const existingSplit = splitDoc.data() as SplitExpense;
  // Only allow updating unsettled participants
  const settledParticipants = existingSplit.participants.filter(p => p.settlementStatus !== 'unsettled');
  const unsettledParticipantUpdates = updates.participants;
  const finalUnsettledParticipants: SplitParticipant[] = [];
  const existingParticipantsMap = new Map(existingSplit.participants.map(p => [p.userId, p]));
  if (updates.splitMethod === 'equally') {
    const numUnsettled = unsettledParticipantUpdates.length;
    if (numUnsettled > 0) {
      const amountPerPerson = parseFloat((updates.totalAmount / numUnsettled).toFixed(2));
      let sum = 0;
      unsettledParticipantUpdates.forEach((p, index) => {
        let amount = amountPerPerson;
        if (index === numUnsettled - 1) {
          amount = parseFloat((updates.totalAmount - sum).toFixed(2));
        }
        sum += amount;
        finalUnsettledParticipants.push({
          userId: p.userId,
          displayName: existingParticipantsMap.get(p.userId)?.displayName || 'Unknown',
          email: existingParticipantsMap.get(p.userId)?.email || '',
          amountOwed: amount,
          settlementStatus: 'unsettled',
        });
      });
    }
  } else if (updates.splitMethod === 'byAmount') {
    unsettledParticipantUpdates.forEach(p => {
      finalUnsettledParticipants.push({
        userId: p.userId,
        displayName: existingParticipantsMap.get(p.userId)?.displayName || 'Unknown',
        email: existingParticipantsMap.get(p.userId)?.email || '',
        amountOwed: p.amountOwed || 0,
        settlementStatus: 'unsettled',
      });
    });
  } else if (updates.splitMethod === 'byPercentage') {
    unsettledParticipantUpdates.forEach(p => {
      const amount = parseFloat(((updates.totalAmount * (p.percentage || 0)) / 100).toFixed(2));
      finalUnsettledParticipants.push({
        userId: p.userId,
        displayName: existingParticipantsMap.get(p.userId)?.displayName || 'Unknown',
        email: existingParticipantsMap.get(p.userId)?.email || '',
        amountOwed: amount,
        percentage: p.percentage,
        settlementStatus: 'unsettled',
      });
    });
  }
  const finalParticipants = [...settledParticipants, ...finalUnsettledParticipants];
  const involvedUserIds = Array.from(new Set(finalParticipants.map(p => p.userId)));
  await updateDoc(splitRef, {
    totalAmount: updates.totalAmount,
    paidBy: updates.payerId,
    participants: finalParticipants,
    splitMethod: updates.splitMethod,
    notes: updates.notes ?? '',
    involvedUserIds,
  });
}

export async function getGroupActivityLog(groupId: string, limitCount: number = 20): Promise<GroupActivityLogEntry[]> {
  if (!groupId) return [];
  const logRef = collection(db, 'groups', groupId, 'activityLog');
  const q = query(logRef, orderBy('timestamp', 'desc'), limit(limitCount));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      actorId: data.actorId || '',
      actorDisplayName: data.actorDisplayName || '',
      actionType: data.actionType || '',
      details: data.details || '',
      timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : '',
    };
  });
}

export function getChatMessages(groupId: string, callback: (messages: ChatMessage[]) => void): () => void {
  const chatMessagesRef = collection(db, 'groups', groupId, 'chat_messages');
  const q = query(chatMessagesRef, orderBy('createdAt', 'asc'), limit(50));
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const messages = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        groupId: data.groupId || groupId,
        userId: data.userId || '',
        userDisplayName: data.userDisplayName || '',
        userAvatarUrl: data.userAvatarUrl || '',
        text: data.text || '',
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : '',
      };
    });
    callback(messages);
  }, (error) => {
    console.error(`[firestore.getChatMessages] Error listening to chat for group ${groupId}:`, error);
  });
  return unsubscribe;
}

export async function addChatMessage(groupId: string, userId: string, userDisplayName: string, userAvatarUrl: string | null, text: string): Promise<void> {
  if (!groupId || !userId || !text.trim()) {
    throw new Error("Missing required fields to send chat message.");
  }
  const chatMessagesRef = collection(db, 'groups', groupId, 'chat_messages');
  await addDoc(chatMessagesRef, {
    groupId,
    userId,
    userDisplayName,
    userAvatarUrl,
    text,
    createdAt: Timestamp.now(),
  });
}

export async function getUserProfile(userId: string): Promise<any | null> {
  if (!userId) return null;
  const userRef = doc(db, 'users', userId);
  const docSnap = await getDoc(userRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    // Ensure subscription field exists with default values
    const subscription = data.subscription || {
      plan: 'free',
      planId: 'free',
      status: 'active',
      startedAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
      currentPeriodEnd: null,
    };
    return {
      uid: userId,
      displayName: data.displayName || '',
      email: data.email || '',
      photoURL: data.photoURL || '',
      subscription,
      ...data,
    };
  }
  return null;
}

export async function getGroupInvitationsForUser(userEmail: string | null): Promise<any[]> {
  if (!userEmail) return [];
  const q = query(
    collection(db, 'group_invitations'),
    where('inviteeEmail', '==', userEmail.toLowerCase()),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      groupName: data.groupName || '',
      inviterDisplayName: data.inviterDisplayName || '',
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : '',
      ...data,
    };
  });
}

export async function acceptGroupInvitation(invitation: any, userProfile: any): Promise<void> {
  if (!invitation || !userProfile) throw new Error('Missing invitation or user profile');
  const groupRef = doc(db, 'groups', invitation.groupId);
  const inviteRef = doc(db, 'group_invitations', invitation.id);
  await runTransaction(db, async (transaction) => {
    const groupDoc = await transaction.get(groupRef);
    if (!groupDoc.exists()) {
      throw new Error('The group no longer exists.');
    }
    const groupData = groupDoc.data();
    if (groupData.memberIds.includes(userProfile.uid)) {
      transaction.update(inviteRef, { status: 'accepted' });
      return;
    }
    const newMemberDetail = {
      uid: userProfile.uid,
      email: userProfile.email,
      displayName: userProfile.displayName || userProfile.email.split('@')[0],
      role: 'member',
    };
    transaction.update(groupRef, {
      memberIds: [...groupData.memberIds, userProfile.uid],
      memberDetails: [...groupData.memberDetails, newMemberDetail],
    });
    transaction.update(inviteRef, { status: 'accepted' });
  });
}

export async function getGroupSavingsGoalsByGroupId(groupId: string): Promise<any[]> {
  if (!groupId) return [];
  const q = query(
    collection(db, 'group_savings_goals'),
    where('groupId', '==', groupId),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : '',
    };
  });
}

export async function addGroupSavingsGoal(
  creatorProfile: any,
  groupId: string,
  goalData: { name: string; targetAmount: number; currency: string; targetDate?: string | null }
): Promise<string> {
  const goalRef = collection(db, 'group_savings_goals');
  const newGoal = {
    groupId,
    name: goalData.name,
    targetAmount: parseFloat(goalData.targetAmount as any),
    currentAmount: 0,
    currency: goalData.currency,
    targetDate: goalData.targetDate || null,
    createdBy: {
      uid: creatorProfile.uid,
      displayName: creatorProfile.displayName || creatorProfile.email,
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const docRef = await addDoc(goalRef, newGoal);
  // TODO: log group activity for goal creation (for full parity with web)
  return docRef.id;
}

// Add group savings goal contribution functions
// --- Types (ensure these are present) ---
import { GroupContributionFormData, GroupGoalContribution, UserProfile } from '../constants/types';
// Remove duplicate Firestore imports below, keep only one set at the top:
// import { Timestamp, doc, runTransaction, increment, collection, query, orderBy, getDocs } from 'firebase/firestore';
// import { db } from './config';

// Firestore collection constants (add if missing)
const GROUPS_COLLECTION = 'groups';
const ACTIVITY_LOG_SUBCOLLECTION = 'activityLog';

// Full implementation of logGroupActivity for group activity logging
async function logGroupActivity(
  groupId: string,
  activityData: Omit<GroupActivityLogEntry, 'id' | 'timestamp'> & { timestamp?: Timestamp }
): Promise<void> {
  try {
    const logRef = collection(db, GROUPS_COLLECTION, groupId, ACTIVITY_LOG_SUBCOLLECTION);
    await addDoc(logRef, {
      ...activityData,
      timestamp: activityData.timestamp || Timestamp.now(),
    });
  } catch (error) {
    console.error(`Error logging activity for group ${groupId}:`, error);
    // Optionally, decide if this error should propagate or be handled silently
  }
}

const GROUP_SAVINGS_GOALS_COLLECTION = 'group_savings_goals';
const GROUP_GOAL_CONTRIBUTIONS_SUBCOLLECTION = 'contributions';

// --- Web-parity addContributionToGroupGoal ---
export async function addContributionToGroupGoal(
  actorProfile: UserProfile,
  groupId: string,
  goalId: string,
  contributionData: GroupContributionFormData
): Promise<void> {
  const goalRef = doc(db, GROUP_SAVINGS_GOALS_COLLECTION, goalId);
  const contributionRef = doc(collection(goalRef, GROUP_GOAL_CONTRIBUTIONS_SUBCOLLECTION));

  await runTransaction(db, async (transaction) => {
    const goalDoc = await transaction.get(goalRef);
    if (!goalDoc.exists()) throw new Error('Savings goal not found.');

    const contributionAmount = parseFloat(contributionData.amount);
    transaction.update(goalRef, {
      currentAmount: increment(contributionAmount),
      updatedAt: Timestamp.now(),
    });

    const newContribution: Omit<GroupGoalContribution, 'id'> = {
      goalId,
      groupId,
      userId: actorProfile.uid,
      userDisplayName: actorProfile.displayName || (actorProfile.email || '').split('@')[0],
      amount: contributionAmount,
      notes: contributionData.notes || '',
      date: new Date().toISOString(),
    };
    transaction.set(contributionRef, newContribution);

    // After transaction logic, log activity
    const goalData = goalDoc.data();
    await logGroupActivity(groupId, {
      actorId: actorProfile.uid,
      actorDisplayName: actorProfile.displayName || (actorProfile.email || ''),
      actionType: 'GROUP_GOAL_CONTRIBUTION',
      details: `contributed ${contributionAmount} to the goal: "${goalData.name}"`,
    });
  });
}

export async function getContributionsForGroupGoal(goalId: string): Promise<any[]> {
  if (!goalId) return [];
  const contributionsRef = collection(db, 'group_savings_goals', goalId, 'contributions');
  const q = query(contributionsRef, orderBy('date', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

// Member management actions
export async function removeMemberFromGroup(groupId: string, actorProfile: any, memberIdToRemove: string, memberDisplayName: string): Promise<void> {
  if (!groupId || !actorProfile || !memberIdToRemove) throw new Error('Missing required fields');
  const groupRef = doc(db, 'groups', groupId);
  await runTransaction(db, async (transaction) => {
    const groupDoc = await transaction.get(groupRef);
    if (!groupDoc.exists()) throw new Error('Group not found');
    const groupData = groupDoc.data();
    const memberIds = (groupData.memberIds || []).filter((id: string) => id !== memberIdToRemove);
    const memberDetails = (groupData.memberDetails || []).filter((m: any) => m.uid !== memberIdToRemove);
    transaction.update(groupRef, { memberIds, memberDetails });
    // Optionally log activity
  });
}

export async function updateMemberRole(groupId: string, actorProfile: any, memberId: string, newRole: 'admin' | 'member'): Promise<void> {
  if (!groupId || !actorProfile || !memberId || !newRole) throw new Error('Missing required fields');
  const groupRef = doc(db, 'groups', groupId);
  await runTransaction(db, async (transaction) => {
    const groupDoc = await transaction.get(groupRef);
    if (!groupDoc.exists()) throw new Error('Group not found');
    const groupData = groupDoc.data();
    const memberDetails = (groupData.memberDetails || []).map((m: any) => m.uid === memberId ? { ...m, role: newRole } : m);
    transaction.update(groupRef, { memberDetails });
    // Optionally log activity
  });
}

export async function transferGroupOwnership(groupId: string, actorProfile: any, newCreatorId: string): Promise<void> {
  if (!groupId || !actorProfile || !newCreatorId) throw new Error('Missing required fields');
  const groupRef = doc(db, 'groups', groupId);
  await runTransaction(db, async (transaction) => {
    const groupDoc = await transaction.get(groupRef);
    if (!groupDoc.exists()) throw new Error('Group not found');
    const groupData = groupDoc.data();
    const memberDetails = (groupData.memberDetails || []).map((m: any) => {
      if (m.uid === newCreatorId) return { ...m, role: 'creator' };
      if (m.uid === groupData.createdBy) return { ...m, role: 'admin' };
      return m;
    });
    transaction.update(groupRef, { createdBy: newCreatorId, memberDetails });
    // Optionally log activity
  });
}

export async function addMembersToGroup(groupId: string, actorProfile: any, newMembers: any[]): Promise<void> {
  if (!groupId || !actorProfile || !newMembers || newMembers.length === 0) throw new Error('Missing required fields');
  const groupRef = doc(db, 'groups', groupId);
  await runTransaction(db, async (transaction) => {
    const groupDoc = await transaction.get(groupRef);
    if (!groupDoc.exists()) throw new Error('Group not found');
    const groupData = groupDoc.data();
    const memberIds = Array.from(new Set([...(groupData.memberIds || []), ...newMembers.map((m: any) => m.uid)]));
    const memberDetails = [...(groupData.memberDetails || [])];
    newMembers.forEach((m: any) => {
      if (!memberDetails.some((md: any) => md.uid === m.uid)) {
        memberDetails.push({
          uid: m.uid,
          email: m.email,
          displayName: m.displayName || m.email || m.phoneNumber,
          role: 'member',
        });
      }
    });
    transaction.update(groupRef, { memberIds, memberDetails });
    // Optionally log activity
  });
}

export async function createUserProfile(
  userId: string,
  email: string | null,
  phoneNumber: string | null,
  displayName: string | null,
  referralCode: string | null,
  defaultCurrency: string
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const docSnap = await getDoc(userRef);
  if (!docSnap.exists()) {
    await setDoc(userRef, {
      uid: userId,
      email: email ? email.toLowerCase() : null,
      phoneNumber: phoneNumber || null,
      displayName: displayName || (email ? email.split('@')[0] : phoneNumber) || 'User',
      photoURL: null,
      defaultCurrency: defaultCurrency || 'USD',
      language: 'en',
      wallet: {},
      role: email?.toLowerCase() === 'admin@splitchey.com' ? 'admin' : 'user',
      status: 'active',
      createdAt: Timestamp.now(),
      hasCompletedOnboarding: false,
      referralCode: referralCode || null,
      rewardPoints: 0,
      currentStreak: 0,
      lastExpenseDate: null,
      subscription: {
        plan: 'free',
        planId: 'free',
        status: 'active',
        startedAt: Timestamp.now().toDate().toISOString(),
        currentPeriodEnd: null,
      },
    });
  }
}

// Fetch incoming friend requests for a user
export async function getIncomingFriendRequests(userId: string) {
  if (!userId) return [];
  const requestsRef = collection(db, 'friend_requests');
  const q = query(requestsRef, where('toUserId', '==', userId), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      fromUserId: data.fromUserId,
      fromUserDisplayName: data.fromUserDisplayName || '',
      fromUserEmail: data.fromUserEmail || '',
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : '',
      ...data,
    };
  });
}

// Send a friend request by email or phone
export async function sendFriendRequest(
  fromUserId: string,
  fromUserEmail: string,
  fromUserDisplayName: string,
  identifier: string,
  inviteType: 'email' | 'phone'
) {
  if (!fromUserId || !identifier) {
    return { success: false, message: 'Missing required fields.' };
  }
  // Find the user by email or phone
  let userQuery;
  if (inviteType === 'email') {
    userQuery = query(collection(db, 'users'), where('email', '==', identifier.toLowerCase()));
  } else {
    userQuery = query(collection(db, 'users'), where('phoneNumber', '==', identifier));
  }
  const userSnapshot = await getDocs(userQuery);
  if (userSnapshot.empty) {
    return { success: false, message: 'User not found.' };
  }
  const toUserDoc = userSnapshot.docs[0];
  const toUserId = toUserDoc.id;
  if (toUserId === fromUserId) {
    return { success: false, message: 'You cannot send a friend request to yourself.' };
  }
  // Check for existing pending request
  const requestsRef = collection(db, 'friend_requests');
  const existingReqQuery = query(
    requestsRef,
    where('fromUserId', '==', fromUserId),
    where('toUserId', '==', toUserId),
    where('status', '==', 'pending')
  );
  const existingReqSnap = await getDocs(existingReqQuery);
  if (!existingReqSnap.empty) {
    return { success: false, message: 'Friend request already sent.' };
  }
  // Create the friend request
  await addDoc(requestsRef, {
    fromUserId,
    fromUserEmail: fromUserEmail || '',
    fromUserDisplayName: fromUserDisplayName || '',
    toUserId,
    toUserEmail: toUserDoc.data().email || '',
    toUserDisplayName: toUserDoc.data().displayName || '',
    status: 'pending',
    createdAt: Timestamp.now(),
  });
  return { success: true, message: 'Friend request sent.' };
}

// Send a debt reminder (push/email/SMS)
export async function sendDebtReminder(
  fromUserProfile: any,
  toUserId: string,
  amount: number,
  currency: string,
  type: 'push' | 'email' | 'sms'
): Promise<void> {
  if (!fromUserProfile || !toUserId) {
    throw new Error("Missing required information to send reminder.");
  }
  const toUser = await getUserProfile(toUserId);
  if (!toUser) {
    throw new Error("Could not find the user to remind.");
  }
  const formattedAmount = `${amount.toFixed(2)} ${currency}`;
  const fromName = fromUserProfile.displayName || fromUserProfile.email;
  const toName = toUser.displayName || toUser.email || toUser.phoneNumber;

  if (type === 'push') {
    const notificationsCollectionRef = collection(db, 'notifications');
    await addDoc(notificationsCollectionRef, {
      toUserId: toUserId,
      fromUserId: fromUserProfile.uid,
      fromUserName: fromName,
      type: 'DEBT_REMINDER',
      title: "Friendly Reminder from SplitChey",
      body: `${fromName} sent you a reminder about an outstanding debt of ${formattedAmount}.`,
      link: `/debts`,
      isRead: false,
      createdAt: Timestamp.now(),
    });
  } else if (type === 'email') {
    if (!toUser.email) {
      throw new Error(`${toName} does not have an email address on file.`);
    }
    const mailCollectionRef = collection(db, 'mail');
    await addDoc(mailCollectionRef, {
      to: [toUser.email],
      message: {
        subject: `Reminder: You have an outstanding debt with ${fromName}`,
        html: `
          <p>Hi ${toName},</p>
          <p>This is a friendly reminder from SplitChey that you have an outstanding debt of <strong>${formattedAmount}</strong> with ${fromName}.</p>
          <p>You can view and settle your debts by logging into your account.</p>
          <p>Thanks,</p>
          <p>The SplitChey Team</p>
        `,
      },
    });
  } else if (type === 'sms') {
    if (!toUser.phoneNumber) {
      throw new Error(`${toName} does not have a phone number on file.`);
    }
    const smsCollectionRef = collection(db, 'messages');
    await addDoc(smsCollectionRef, {
      to: toUser.phoneNumber,
      body: `SplitChey Reminder: Hi ${toName}, this is a reminder about your outstanding debt of ${formattedAmount} with ${fromName}.`,
    });
  }
}

// Accept a friend request
export async function acceptFriendRequest(requestId: string, fromUserProfile: any, toUserProfile: any): Promise<void> {
  const requestRef = doc(db, 'friend_requests', requestId);
  await runTransaction(db, async (transaction) => {
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists()) {
      throw new Error('Friend request does not exist or has already been processed.');
    }
    const requestData = requestSnap.data();
    if (requestData.status !== 'pending') {
      throw new Error('Friend request is not pending.');
    }
    const now = Timestamp.now();
    const friendDataForFromUser = {
      email: toUserProfile.email,
      phoneNumber: toUserProfile.phoneNumber || null,
      displayName: toUserProfile.displayName,
      addedAt: now,
      wallet: toUserProfile.wallet || {},
    };
    const friendDataForToUser = {
      email: fromUserProfile.email,
      phoneNumber: fromUserProfile.phoneNumber || null,
      displayName: fromUserProfile.displayName,
      addedAt: now,
      wallet: fromUserProfile.wallet || {},
    };
    const fromUserFriendRef = doc(db, 'users', fromUserProfile.uid, 'friends', toUserProfile.uid);
    const toUserFriendRef = doc(db, 'users', toUserProfile.uid, 'friends', fromUserProfile.uid);
    transaction.set(fromUserFriendRef, friendDataForFromUser);
    transaction.set(toUserFriendRef, friendDataForToUser);
    transaction.delete(requestRef);
  });
}

// Reject a friend request
export async function rejectFriendRequest(requestId: string): Promise<void> {
  const requestRef = doc(db, 'friend_requests', requestId);
  await deleteDoc(requestRef);
}

// Remove a friend
export async function removeFriend(currentUserId: string, friendUserId: string): Promise<void> {
  const currentUserFriendRef = doc(db, 'users', currentUserId, 'friends', friendUserId);
  const friendUserFriendRef = doc(db, 'users', friendUserId, 'friends', currentUserId);
  await Promise.all([
    deleteDoc(currentUserFriendRef),
    deleteDoc(friendUserFriendRef),
  ]);
}

// Local updateUserProfile implementation
const updateUserProfile = async (uid: string, updates: { displayName?: string; defaultCurrency?: string }) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, updates);
};

// User Profile Photo Upload
export const updateUserProfilePhoto = async (userId: string, photoUri: string): Promise<string> => {
  if (!photoUri) throw new Error("No photo URI provided.");

  // Fetch the image as a blob
  const response = await fetch(photoUri);
  const blob = await response.blob();

  const storageRef = ref(storage, `profile-pictures/${userId}`);
  // Upload the blob
  await uploadBytes(storageRef, blob);
  const downloadURL = await getDownloadURL(storageRef);

  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { photoURL: downloadURL, updatedAt: Timestamp.now() });

  if (auth.currentUser && auth.currentUser.uid === userId) {
    await updateProfile(auth.currentUser, { photoURL: downloadURL });
  }

  return downloadURL;
};

// Subscription Management
export const upgradeUserToPremium = async (userId: string, period: 'monthly' | 'yearly'): Promise<void> => {
  console.log(`[mobile] Upgrading user ${userId} to premium ${period}`);
  const userRef = doc(db, 'users', userId);
  const now = new Date();
  const periodEnd = new Date(now);

  if (period === 'monthly') {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  }
  
  const subscriptionUpdate = {
    plan: 'premium',
    planId: `premium_${period}`,
    status: 'active',
    startedAt: now.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
  };
  
  console.log(`[mobile] Subscription update payload:`, subscriptionUpdate);
  await updateDoc(userRef, { subscription: subscriptionUpdate });
  console.log(`[mobile] User upgraded successfully`);
};

export const cancelUserSubscription = async (userId: string): Promise<void> => {
  console.log(`[mobile] Canceling subscription for user ${userId}`);
  
  // Validate input
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  // Check if user exists first
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  if (!userDoc.exists()) {
    throw new Error('User not found in database');
  }
  
  console.log(`[mobile] User found, current data:`, userDoc.data());
  
  const freeSubscriptionUpdate = {
    plan: 'free',
    planId: 'free',
    status: 'active',
    startedAt: new Date().toISOString(),
  };

  const updatePayload = {
    subscription: freeSubscriptionUpdate
  };

  console.log(`[mobile] Cancel subscription payload:`, updatePayload);
  
  try {
    await updateDoc(userRef, updatePayload);
    console.log(`[mobile] Subscription canceled successfully`);
  } catch (updateError: any) {
    console.error(`[mobile] UpdateDoc failed:`, updateError);
    console.error(`[mobile] UpdateDoc error details:`, {
      code: updateError.code,
      message: updateError.message,
      stack: updateError.stack
    });
    throw updateError;
  }
}; 

export async function getExpensesByUser(userId: string): Promise<Expense[]> {
  if (!userId) return [];
  const expensesRef = collection(db, 'expenses');
  const q = query(expensesRef, where('userId', '==', userId), orderBy('date', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      description: data.description || 'No description',
      amount: typeof data.amount === 'number' ? data.amount : 0,
      currency: data.currency || 'USD',
      category: data.category || 'Other',
      date: data.date?.toDate ? data.date.toDate().toISOString().split('T')[0] : '',
      notes: data.notes || '',
      groupId: data.groupId || undefined,
      groupName: data.groupName || undefined,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : '',
      userId: data.userId || 'Unknown User',
      paidById: data.paidById || data.userId || 'Unknown User',
      paidByName: data.paidByName || 'Unknown Payer',
    };
  });
}

export async function addExpense(userId: string, expenseData: any, userProfile: any, source?: 'manual' | 'ocr' | 'import'): Promise<string> {
  if (!userId) throw new Error('User ID is required to add an expense.');
  if (!expenseData.description || !expenseData.amount || !expenseData.currency || !expenseData.category || !expenseData.date) {
    throw new Error('Missing required expense fields.');
  }
  const expenseDoc: any = {
    userId,
    paidById: userId,
    paidByName: userProfile?.displayName || userProfile?.email || 'Unknown',
    description: expenseData.description,
    amount: parseFloat(expenseData.amount),
    currency: expenseData.currency,
    category: expenseData.category,
    date: Timestamp.fromDate(new Date(expenseData.date)),
    notes: expenseData.notes || '',
    receiptUrl: expenseData.receiptUrl || null,
    createdAt: Timestamp.now(),
    isRecurring: expenseData.isRecurring || false,
    recurrence: expenseData.recurrence || 'none',
    recurrenceEndDate: expenseData.recurrenceEndDate ? Timestamp.fromDate(new Date(expenseData.recurrenceEndDate)) : null,
    tags: expenseData.tags ? expenseData.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t) : [],
    groupId: expenseData.groupId || null,
    groupName: expenseData.groupName || null,
  };
  const docRef = await addDoc(collection(db, 'expenses'), expenseDoc);

  // Budget notification logic
  try {
    const budgets = await getBudgetsByUser(userId);
    const categoryBudget = budgets.find(b => b.category === expenseData.category);
    if (categoryBudget) {
      // Get all expenses for this user and category
      const expensesRef = collection(db, 'expenses');
      const q = query(expensesRef, where('userId', '==', userId), where('category', '==', expenseData.category));
      const querySnapshot = await getDocs(q);
      const total = querySnapshot.docs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + (typeof data.amount === 'number' ? data.amount : 0);
      }, 0);
      if (total > categoryBudget.amount) {
        Notifications.scheduleNotificationAsync({
          content: {
            title: 'Budget Limit Exceeded',
            body: `You have exceeded your budget for ${expenseData.category}.`,
            data: { type: 'budget', category: expenseData.category },
          },
          trigger: null,
        });
      }
    }
  } catch (e) {
    // Ignore notification errors
  }

  return docRef.id;
}

export async function deleteExpense(expenseId: string): Promise<void> {
  if (!expenseId) return;
  const expenseRef = doc(db, 'expenses', expenseId);
  await deleteDoc(expenseRef);
} 

// Update group name and/or other details
export async function updateGroupDetails(
  groupId: string,
  actorProfile: any,
  data: { name?: string }
): Promise<void> {
  const groupRef = doc(db, 'groups', groupId);
  const batch = writeBatch(db);

  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) throw new Error('Group not found for update.');
  const existingGroupData = groupSnap.data();

  const updateData: { [key: string]: any } = { ...data, updatedAt: Timestamp.now() };
  batch.update(groupRef, updateData);

  if (data.name && existingGroupData.name !== data.name) {
    // Update groupName in associated expenses
    const expensesQuery = query(collection(db, 'expenses'), where('groupId', '==', groupId));
    const expensesSnapshot = await getDocs(expensesQuery);
    expensesSnapshot.forEach(expenseDoc => {
      batch.update(expenseDoc.ref, { groupName: data.name });
    });
    await logGroupActivity(groupId, {
      actorId: actorProfile.uid,
      actorDisplayName: actorProfile.displayName || actorProfile.email,
      actionType: 'GROUP_NAME_UPDATED',
      details: `changed group name from "${existingGroupData.name}" to "${data.name}"`,
    });
  }
  await batch.commit();
}

// Update group image
export async function updateGroupImageUrl(groupId: string, imageUrl: string): Promise<void> {
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    imageUrl: imageUrl,
    updatedAt: Timestamp.now(),
  });
} 

export async function getIncomeByUser(userId: string): Promise<Income[]> {
  if (!userId) return [];
  const incomeRef = collection(db, 'income');
  const q = query(incomeRef, where('userId', '==', userId), orderBy('date', 'desc'));
  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        source: data.source || 'No source',
        amount: typeof data.amount === 'number' ? data.amount : 0,
        currency: data.currency || 'USD',
        date: data.date?.toDate ? data.date.toDate().toISOString().split('T')[0] : '',
        notes: data.notes || '',
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : '',
        userId: data.userId || 'Unknown User',
      };
    });
  } catch (error) {
    console.error('[mobile] Error getting income:', error);
    return [];
  }
} 

export type BudgetPeriod = "weekly" | "monthly" | "yearly" | "custom";
export type Budget = {
  id?: string;
  userId: string;
  name: string;
  category: string;
  amount: number;
  currency: string;
  period: BudgetPeriod;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt?: string;
  imageUrl?: string;
};

export async function getBudgetsByUser(userId: string): Promise<Budget[]> {
  if (!userId) return [];
  const budgetsRef = collection(db, 'budgets');
  const q = query(budgetsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      name: data.name,
      category: data.category,
      amount: typeof data.amount === 'number' ? data.amount : 0,
      currency: data.currency || 'USD',
      period: data.period || 'monthly',
      startDate: data.startDate || '',
      endDate: data.endDate || '',
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : '',
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : undefined,
      imageUrl: data.imageUrl || undefined,
    };
  });
} 

export async function addBudget(userId: string, budgetData: Partial<Budget>): Promise<string> {
  if (!userId) throw new Error('User ID is required to add a budget.');
  const now = new Date();
  const docRef = await addDoc(collection(db, 'budgets'), {
    ...budgetData,
    userId,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  });
  return docRef.id;
}

export async function updateBudget(budgetId: string, budgetData: Partial<Budget>): Promise<void> {
  const budgetRef = doc(db, 'budgets', budgetId);
  const updatePayload: { [key: string]: any } = { ...budgetData, updatedAt: Timestamp.now() };
  await updateDoc(budgetRef, updatePayload);
}

export async function deleteBudget(budgetId: string): Promise<void> {
  const budgetRef = doc(db, 'budgets', budgetId);
  await deleteDoc(budgetRef);
} 

export async function getGlobalCategories(): Promise<{ id: string; name: string; icon: string }[]> {
  const categoriesRef = collection(db, 'global_categories');
  const q = query(categoriesRef);
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      icon: data.icon || '',
    };
  });
} 