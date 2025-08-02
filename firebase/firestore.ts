import * as Notifications from 'expo-notifications';
import { updateProfile } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, limit, onSnapshot, orderBy, query, runTransaction, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { awardAchievement } from './achievements';
import { auth, db, storage } from './config';

import { ActivityActionType, Budget, ChatMessage, CreateSplitExpenseData, Expense, ExpenseFormData, Group, GroupActivityLogEntry, GroupContributionFormData, GroupGoalContribution, GroupMemberDetail, Income, IncomeFormData, SplitExpense, SplitParticipant, UserProfile, CurrencyCode, SUPPORTED_CURRENCIES } from '../constants/types';

// Collection Names
const USERS_COLLECTION = 'users';
const EXPENSES_COLLECTION = 'expenses';
const FRIEND_REQUESTS_COLLECTION = 'friend_requests';
const FRIENDS_SUBCOLLECTION = 'friends';
const GROUPS_COLLECTION = 'groups';
const ACTIVITY_LOG_SUBCOLLECTION = 'activityLog';
const INCOME_COLLECTION = 'income';
const REMINDERS_COLLECTION = 'reminders';
const BUDGETS_COLLECTION = 'budgets';
const SPLIT_EXPENSES_COLLECTION = 'split_expenses';
const SAVINGS_GOALS_COLLECTION = 'savings_goals';
const GOAL_CONTRIBUTIONS_COLLECTION = 'goal_contributions';
const GROUP_SAVINGS_GOALS_COLLECTION = 'group_savings_goals';
const GROUP_GOAL_CONTRIBUTIONS_SUBCOLLECTION = 'contributions';
const GROUP_INVITATIONS_COLLECTION = 'group_invitations';
const GLOBAL_CATEGORIES_COLLECTION = 'global_categories';
const APP_SETTINGS_COLLECTION = 'app_settings';
const ANNOUNCEMENTS_COLLECTION = 'announcements';
const INVESTMENTS_COLLECTION = 'investments';
const SITE_CONTENT_COLLECTION = 'site_content';
const BLOG_POSTS_COLLECTION = 'blog_posts';
const NOTIFICATIONS_COLLECTION = 'notifications';
const MAIL_COLLECTION = 'mail';
const MESSAGES_COLLECTION = 'messages';
const CHAT_MESSAGES_SUBCOLLECTION = 'chat_messages';
const ACHIEVEMENTS_SUBCOLLECTION = 'achievements';

export async function getRecentExpensesByUser(userId: string, count: number = 5): Promise<Expense[]> {
 try {
    if (!userId) return [];
    const expenses = await getExpensesByUser(userId);
    // Already sorted by date descending in getExpensesByUser
    return expenses.slice(0, count);
  } catch (error) {
    console.error("[firestore.getRecentExpensesByUser] Error getting recent documents: ", error);
    throw error;
  }
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
export async function getGroupsForUser(userId: string): Promise<Group[]> {
  if (!userId) return [];
  const groupsRef = collection(db, 'groups');
  const q = query(groupsRef, where('memberIds', 'array-contains', userId));
  const querySnapshot = await getDocs(q);

  const groupsWithMemberProfiles = await Promise.all(querySnapshot.docs.map(async docSnap => {
    const groupData = docSnap.data();
    const memberIds = groupData.memberIds || [];
    const memberProfiles: { uid: string; displayName: string; email: string; role: string; profilePictureUrl?: string }[] = [];

    for (const memberId of memberIds) {
      const userProfile = await getUserProfile(memberId);
      if (userProfile) {
        memberProfiles.push({
          uid: userProfile.uid,
          displayName: userProfile.displayName || userProfile.email.split('@')[0],
          email: userProfile.email,
          role: groupData.createdBy === userProfile.uid ? 'creator' : 'member', // Determine role
          profilePictureUrl: userProfile.photoURL || undefined,
        });
      }
    }

    return {
      id: docSnap.id,
      ...groupData,
      memberDetails: memberProfiles, // Populate with full member profiles
    } as Group;
  }));

  return groupsWithMemberProfiles;
}

// Fetch all splits where involvedUserIds contains userId (web logic)
export async function getSplitExpensesForUser(userId: string): Promise<SplitExpense[]> {
  if (!userId) return [];
  const splitsRef = collection(db, 'split_expenses');
  const q = query(splitsRef, where('involvedUserIds', 'array-contains', userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      originalExpenseId: data.originalExpenseId || '',
      originalExpenseDescription: data.originalExpenseDescription || 'Split Expense',
      currency: data.currency || 'USD',
      splitMethod: data.splitMethod || 'equally',
      totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
      paidBy: data.paidBy || '',
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


export async function createSplitExpense(splitData: CreateSplitExpenseData): Promise<string> {
  try {
    if (!splitData.paidBy) throw new Error("Payer ID (paidBy) is required.");
    if (!splitData.originalExpenseId) throw new Error("Original expense ID is required.");
    if (!splitData.originalExpenseDescription) throw new Error("Original expense description is required.");
    if (splitData.participants.length === 0) throw new Error("At least one participant is required.");

    let validatedParticipants = [...splitData.participants];

    if (splitData.splitMethod === 'byAmount') {
      const calculatedTotalOwed = validatedParticipants.reduce((sum, p) => sum + p.amountOwed, 0);
      if (Math.abs(calculatedTotalOwed - splitData.totalAmount) > 0.01) {
        throw new Error(`Sum of amounts owed (${calculatedTotalOwed.toFixed(2)}) by participants does not match total expense amount (${splitData.totalAmount.toFixed(2)}).`);
      }
    } else if (splitData.splitMethod === 'byPercentage') {
      const totalPercentage = validatedParticipants.reduce((sum, p) => sum + (p.percentage || 0), 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        throw new Error(`Sum of percentages (${totalPercentage.toFixed(2)}%) does not equal 100%.`);
      }
      validatedParticipants = validatedParticipants.map(p => ({
        ...p,
        amountOwed: parseFloat(((splitData.totalAmount * (p.percentage || 0)) / 100).toFixed(2)),
      }));
    } else if (splitData.splitMethod === 'equally') {
      const numParticipants = validatedParticipants.length;
      if (numParticipants === 0) throw new Error("Cannot split equally with zero participants.");
      const amountPerPerson = parseFloat((splitData.totalAmount / numParticipants).toFixed(2));
      // Adjust for rounding for the last participant
      let sumOfCalculatedAmounts = 0;
      validatedParticipants = validatedParticipants.map((p, index) => {
        let currentAmountOwed = amountPerPerson;
        if (index === numParticipants - 1) {
            currentAmountOwed = parseFloat((splitData.totalAmount - sumOfCalculatedAmounts).toFixed(2));
        } else {
            sumOfCalculatedAmounts += amountPerPerson;
        }
        return {...p, amountOwed: currentAmountOwed};
      });
    }

    const finalParticipants = validatedParticipants.map(p => ({
      ...p,
      settlementStatus: p.userId === splitData.paidBy ? 'settled' : 'unsettled',
    } as SplitParticipant));


    const involvedUserIds = Array.from(new Set([splitData.paidBy, ...finalParticipants.map(p => p.userId)]));

    const dataToSave: Omit<SplitExpense, 'id' | 'createdAt' | 'updatedAt'> & {createdAt: Timestamp, updatedAt: Timestamp} = {
      originalExpenseId: splitData.originalExpenseId,
      originalExpenseDescription: splitData.originalExpenseDescription,
      currency: splitData.currency,
      splitMethod: splitData.splitMethod,
      totalAmount: splitData.totalAmount,
      paidBy: splitData.paidBy,
      participants: finalParticipants,
      involvedUserIds,
      groupId: splitData.groupId || null,
      groupName: splitData.groupName || null,
      notes: splitData.notes || '',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, SPLIT_EXPENSES_COLLECTION), dataToSave);

    if (splitData.groupId && splitData.actorProfile) {
      await logGroupActivity(splitData.groupId, {
        actorId: splitData.actorProfile.uid,
        actorDisplayName: splitData.actorProfile.displayName || splitData.actorProfile.email,
        actionType: ActivityActionType.EXPENSE_SPLIT_IN_GROUP,
        details: `split the expense "${splitData.originalExpenseDescription}" among ${splitData.participants.length} members in group "${splitData.groupName || 'Unknown Group'}"`,
        relatedExpenseId: splitData.originalExpenseId,
        relatedExpenseName: splitData.originalExpenseDescription,
      });
    }
    
    // Achievement check
    if (splitData.actorProfile) {
        await awardAchievement(splitData.actorProfile.uid, 'FIRST_SPLIT');
    }

    return docRef.id;
  } catch (error) {
    console.error("[firestore.createSplitExpense] Error creating split expense: ", error);
    throw error;
  }
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

export async function requestSettlementApproval(splitExpenseId: string, actorProfile: UserProfile): Promise<void> {
  try {
    const splitRef = doc(db, 'split_expenses', splitExpenseId);
    const splitDoc = await getDoc(splitRef);
    if (!splitDoc.exists()) throw new Error('Split expense not found.');
    
    const splitData = splitDoc.data() as SplitExpense;
    const participant = splitData.participants.find(p => p.userId === actorProfile.uid);
    if (!participant) throw new Error('You are not a participant in this split.');
    if (participant.settlementStatus !== 'unsettled') throw new Error('This debt is either already settled or pending approval.');
    
    const updatedParticipants = splitData.participants.map(p =>
      p.userId === actorProfile.uid ? { ...p, settlementStatus: 'pending_approval' } : p
    );
    
    await updateDoc(splitRef, { participants: updatedParticipants });
  } catch (error) {
    console.error("[firestore.requestSettlementApproval] Error requesting settlement approval: ", error);
    throw error;
  }
}

export async function approveSettlement(splitExpenseId: string, participantUserId: string, actorProfile: UserProfile): Promise<void> {
  try {
    const splitRef = doc(db, 'split_expenses', splitExpenseId);
    const splitDoc = await getDoc(splitRef);
    if (!splitDoc.exists()) throw new Error('Split expense not found.');
    
    const splitData = splitDoc.data() as SplitExpense;
    if (splitData.paidBy !== actorProfile.uid) throw new Error('Only the payer can approve settlements.');
    
    const participant = splitData.participants.find(p => p.userId === participantUserId);
    if (!participant) throw new Error('Participant not found in this split.');
    if (participant.settlementStatus !== 'pending_approval') throw new Error('This settlement is not pending approval.');
    
    const updatedParticipants = splitData.participants.map(p =>
      p.userId === participantUserId ? { ...p, settlementStatus: 'settled' } : p
    );
    
    await updateDoc(splitRef, { participants: updatedParticipants });
  } catch (error) {
    console.error("[firestore.approveSettlement] Error approving settlement: ", error);
    throw error;
  }
}

export async function rejectSettlement(splitExpenseId: string, participantUserId: string, actorProfile: UserProfile): Promise<void> {
  try {
    const splitRef = doc(db, 'split_expenses', splitExpenseId);
    const splitDoc = await getDoc(splitRef);
    if (!splitDoc.exists()) throw new Error('Split expense not found.');
    
    const splitData = splitDoc.data() as SplitExpense;
    if (splitData.paidBy !== actorProfile.uid) throw new Error('Only the payer can reject settlements.');
    
    const participant = splitData.participants.find(p => p.userId === participantUserId);
    if (!participant) throw new Error('Participant not found in this split.');
    if (participant.settlementStatus !== 'pending_approval') throw new Error('This settlement is not pending approval.');
    
    const updatedParticipants = splitData.participants.map(p =>
      p.userId === participantUserId ? { ...p, settlementStatus: 'unsettled' } : p
    );
    
    await updateDoc(splitRef, { participants: updatedParticipants });
  } catch (error) {
    console.error("[firestore.rejectSettlement] Error rejecting settlement: ", error);
    throw error;
  }
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
 
export async function getGroupInvitationsForUser(userEmail: string | null, userPhoneNumber: string | null): Promise<any[]> {
  const invitations: any[] = [];
 
  // Fetch by email if available
  if (userEmail) {
    const qEmail = query(
      collection(db, 'group_invitations'),
      where('inviteeEmail', '==', userEmail.toLowerCase()),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const querySnapshotEmail = await getDocs(qEmail);
    querySnapshotEmail.forEach(docSnap => {
      const data = docSnap.data();
      invitations.push({
        id: docSnap.id,
        groupName: data.groupName || '',
        inviterDisplayName: data.inviterDisplayName || '',
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : '',
        ...data,
      });
    });
  }
 
  // Fetch by phone number if available and different from email
  if (userPhoneNumber) {
    const qPhone = query(
      collection(db, 'group_invitations'),
      where('inviteePhoneNumber', '==', userPhoneNumber),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const querySnapshotPhone = await getDocs(qPhone);
    querySnapshotPhone.forEach(docSnap => {
      const data = docSnap.data();
      // Only add if not already added by email (to avoid duplicates)
      if (!invitations.some(invite => invite.id === docSnap.id)) {
        invitations.push({
          id: docSnap.id,
          groupName: data.groupName || '',
          inviterDisplayName: data.inviterDisplayName || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : '',
          ...data,
        });
      }
    });
  }
 
  // Sort by createdAt to maintain consistent order
  return invitations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
 
// Full implementation of logGroupActivity for group activity logging
async function logGroupActivity(
  groupId: string,
  activityData: Omit<GroupActivityLogEntry, 'id' | 'timestamp'> & { timestamp?: Timestamp, relatedMemberId?: string | null, relatedMemberName?: string | null }
): Promise<void> {
  try {
    const logRef = collection(db, GROUPS_COLLECTION, groupId, ACTIVITY_LOG_SUBCOLLECTION);
    await addDoc(logRef, {
      ...activityData,
      timestamp: activityData.timestamp || Timestamp.now(),
      relatedMemberId: activityData.relatedMemberId || null,
      relatedMemberName: activityData.relatedMemberName || null,
    });
  } catch (error) {
    console.error(`Error logging activity for group ${groupId}:`, error);
    // Optionally, decide if this error should propagate or be handled silently
  }
}
 
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
      actionType: ActivityActionType.GROUP_GOAL_CONTRIBUTION,
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
  try {
    if (!userId) {
      return [];
    }
    
    // Part 1: Fetch user's own created expenses
    const expensesQuery = query(collection(db, EXPENSES_COLLECTION), where('userId', '==', userId));
    const expensesSnapshot = await getDocs(expensesQuery);
    const userExpenses = expensesSnapshot.docs
      .map(doc => mapExpenseDocumentToExpenseObject(doc))
      .filter(Boolean) as Expense[];

    // Part 2: Fetch splits and create "virtual" expenses for the user's share
    const splitsQuery = query(collection(db, SPLIT_EXPENSES_COLLECTION), where('involvedUserIds', 'array-contains', userId));
    const splitsSnapshot = await getDocs(splitsQuery);
    
    const virtualExpenses: Expense[] = [];
    const splitsToProcess = splitsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as SplitExpense & { id: string }))
      .filter(split => {
        const participant = split.participants.find(p => p.userId === userId);
        // We want splits where the user is a participant but NOT the sole payer of the whole amount
        return participant && split.paidBy !== userId;
      });

    if (splitsToProcess.length > 0) {
      // Batch-fetch the original expense documents for context
      const originalExpenseIds = Array.from(new Set(splitsToProcess.map(s => s.originalExpenseId)));
      const originalExpensesMap = new Map<string, Expense>();

      // Firestore 'in' query is limited to 30 items
      const idChunks = [];
      for (let i = 0; i < originalExpenseIds.length; i += 30) {
        idChunks.push(originalExpenseIds.slice(i, i + 30));
      }

      for (const chunk of idChunks) {
        if (chunk.length > 0) {
          const originalExpensesQuery = query(collection(db, EXPENSES_COLLECTION), where('__name__', 'in', chunk));
          const originalExpensesSnapshot = await getDocs(originalExpensesQuery);
          originalExpensesSnapshot.forEach(doc => {
            const expense = mapExpenseDocumentToExpenseObject(doc);
            if (expense) {
              originalExpensesMap.set(doc.id, expense);
            }
          });
        }
      }

      splitsToProcess.forEach(split => {
        const participant = split.participants.find(p => p.userId === userId)!;
        const originalExpense = originalExpensesMap.get(split.originalExpenseId);
        
        if (originalExpense) {
          virtualExpenses.push({
            ...originalExpense,
            id: `${split.id!}-${userId}`,
            description: `[Split] ${split.originalExpenseDescription}`,
            amount: participant.amountOwed,
            notes: `Your share of an expense paid by ${originalExpense.paidByName}. Original notes: ${originalExpense.notes || ''}`,
            userId: userId,
            isSplitShare: true,
            isRecurring: false,
            recurrence: 'none',
            recurrenceEndDate: undefined,
          });
        }
      });
    }

    const allUserFinancialEvents = [...userExpenses, ...virtualExpenses];
    allUserFinancialEvents.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      // if dates are same, sort by creation time if available
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return createdB - createdA;
    });
    
    return allUserFinancialEvents;

  } catch (error: any) {
    console.error("[firestore.getExpensesByUser] Error getting documents: ", error);
    throw error;
  }
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
      actionType: ActivityActionType.GROUP_NAME_UPDATED,
      details: `changed group name from "${existingGroupData.name}" to "${data.name}"`,
    });
  }
  await batch.commit();
}
 
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
        isRecurring: data.isRecurring || false,
        recurrence: data.recurrence || 'none',
        recurrenceEndDate: data.recurrenceEndDate?.toDate ? data.recurrenceEndDate.toDate().toISOString().split('T')[0] : undefined,
        lastInstanceCreated: data.lastInstanceCreated?.toDate ? data.lastInstanceCreated.toDate().toISOString().split('T')[0] : undefined,
      };
    });
  } catch (error) {
    console.error('[mobile] Error getting income:', error);
    return [];
  }
}

export async function addIncome(userId: string, incomeData: IncomeFormData): Promise<string> {
  if (!userId) throw new Error('User ID is required to add income.');
  
  const now = new Date();
  const incomeDoc = {
    userId,
    source: incomeData.source,
    amount: parseFloat(incomeData.amount),
    currency: incomeData.currency,
    date: Timestamp.fromDate(new Date(incomeData.date)),
    notes: incomeData.notes || '',
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
    isRecurring: incomeData.isRecurring || false,
    recurrence: incomeData.recurrence || 'none',
    recurrenceEndDate: incomeData.recurrenceEndDate ? Timestamp.fromDate(new Date(incomeData.recurrenceEndDate)) : null,
    lastInstanceCreated: incomeData.lastInstanceCreated ? Timestamp.fromDate(new Date(incomeData.lastInstanceCreated)) : null,
  };

  try {
    const docRef = await addDoc(collection(db, INCOME_COLLECTION), incomeDoc);
    return docRef.id;
  } catch (error) {
    console.error('[mobile] Error adding income:', error);
    throw error;
  }
}

export async function updateIncome(incomeId: string, incomeData: Partial<IncomeFormData>): Promise<void> {
  if (!incomeId) throw new Error('Income ID is required to update income.');
  
  const incomeRef = doc(db, INCOME_COLLECTION, incomeId);
  const updateData: any = {
    updatedAt: Timestamp.now(),
  };

  if (incomeData.source !== undefined) updateData.source = incomeData.source;
  if (incomeData.amount !== undefined) updateData.amount = parseFloat(incomeData.amount);
  if (incomeData.currency !== undefined) updateData.currency = incomeData.currency;
  if (incomeData.date !== undefined) updateData.date = Timestamp.fromDate(new Date(incomeData.date));
  if (incomeData.notes !== undefined) updateData.notes = incomeData.notes;
  if (incomeData.isRecurring !== undefined) updateData.isRecurring = incomeData.isRecurring;
  if (incomeData.recurrence !== undefined) updateData.recurrence = incomeData.recurrence;
  if (incomeData.recurrenceEndDate !== undefined) {
    updateData.recurrenceEndDate = incomeData.recurrenceEndDate ? Timestamp.fromDate(new Date(incomeData.recurrenceEndDate)) : null;
  }
  if (incomeData.lastInstanceCreated !== undefined) {
    updateData.lastInstanceCreated = incomeData.lastInstanceCreated ? Timestamp.fromDate(new Date(incomeData.lastInstanceCreated)) : null;
  }

  try {
    await updateDoc(incomeRef, updateData);
  } catch (error) {
    console.error('[mobile] Error updating income:', error);
    throw error;
  }
}

export async function deleteIncome(incomeId: string): Promise<void> {
  if (!incomeId) throw new Error('Income ID is required to delete income.');
  
  try {
    const incomeRef = doc(db, INCOME_COLLECTION, incomeId);
    await deleteDoc(incomeRef);
  } catch (error) {
    console.error('[mobile] Error deleting income:', error);
    throw error;
  }
}
 
 
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
export async function getExpenseById(expenseId: string): Promise<Expense | null> {
  try {
    const docRef = doc(db, "expenses", expenseId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return mapExpenseDocumentToExpenseObject(docSnap);
    } else {
      return null;
    }
  } catch (error) {
    console.error("[firestore.getExpenseById] Error getting document by ID: ", error);
    throw error;
  }
}
 
export async function updateExpense(expenseId: string, expenseData: Partial<ExpenseFormData>): Promise<void> {
  try {
    const docRef = doc(db, "expenses", expenseId);
    const updateData: { [key: string]: any } = { updatedAt: Timestamp.now() };
 
    // Helper to create a Date at local midnight (not UTC midnight)
    function localDateToLocalMidnight(dateStr: string) {
      // dateStr is 'YYYY-MM-DD'
      const [year, month, day] = dateStr.split('-').map(Number);
      // This creates a Date at local midnight in the server's timezone
      return new Date(year, month - 1, day, 0, 0, 0);
    }
 
    if (expenseData.description !== undefined) updateData.description = expenseData.description;
    if (expenseData.amount !== undefined) updateData.amount = parseFloat(expenseData.amount);
    if (expenseData.currency !== undefined) updateData.currency = expenseData.currency;
    if (expenseData.category !== undefined) updateData.category = expenseData.category;
    if (expenseData.date !== undefined) {
      // Use local midnight, not UTC midnight
      updateData.date = Timestamp.fromDate(localDateToLocalMidnight(expenseData.date));
    }
    if (expenseData.notes !== undefined) updateData.notes = expenseData.notes;
 
    if (expenseData.receiptUrl === null) {
      updateData.receiptUrl = null;
    } else if (expenseData.receiptUrl !== undefined) {
      updateData.receiptUrl = expenseData.receiptUrl;
    }
 
    if (expenseData.groupId && expenseData.groupId !== '___PERSONAL___') {
      updateData.groupId = expenseData.groupId;
      updateData.groupName = expenseData.groupName;
    } else {
      updateData.groupId = null;
      updateData.groupName = null;
    }
 
    if (expenseData.isRecurring !== undefined) updateData.isRecurring = expenseData.isRecurring;
    if (expenseData.recurrence !== undefined) updateData.recurrence = expenseData.recurrence;
    if (expenseData.recurrenceEndDate !== undefined) {
      updateData.recurrenceEndDate = expenseData.recurrenceEndDate
        ? Timestamp.fromDate(localDateToLocalMidnight(expenseData.recurrenceEndDate))
        : null;
    }
    if (expenseData.tags !== undefined) {
      updateData.tags = expenseData.tags
        ? expenseData.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
        : [];
    }
 
    console.log("[firestore.updateExpense] Update data:", updateData);
    if (Object.keys(updateData).length > 1) {
      await updateDoc(docRef, updateData);
    }
  } catch (error) {
    console.error("[firestore.updateExpense] Error updating document: ", error);
    throw error;
  }
}
function mapExpenseDocumentToExpenseObject(docSnap: any): Expense | null {
  const docId = docSnap.id;
  try {
    const data = docSnap.data();
    if (!data) {
      console.error(`[firestore.mapExpense] Document ${docId} has no data.`);
      return null;
    }
 
    if (!data.date || typeof data.date.toDate !== 'function') {
      console.error(`[firestore.mapExpense] Document ${docId} has invalid or missing 'date' field:`, data.date);
      return null;
    }
    if (!data.createdAt || typeof data.createdAt.toDate !== 'function') {
      console.error(`[firestore.mapExpense] Document ${docId} has invalid or missing 'createdAt' field:`, data.createdAt);
      return null;
    }
 
    return {
      id: docId,
      description: data.description || 'No description',
      amount: typeof data.amount === 'number' ? data.amount : 0,
      currency: data.currency || 'USD',
      category: data.category || 'Other',
      date: (data.date as Timestamp).toDate().toISOString().split('T')[0],
      notes: data.notes || '',
      receiptUrl: data.receiptUrl || undefined,
      groupId: data.groupId || undefined,
      groupName: data.groupName || undefined,
      createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      userId: data.userId || 'Unknown User',
      paidById: data.paidById || data.userId || 'Unknown User', // Fallback for old docs
      paidByName: data.paidByName || 'Unknown Payer', // Fallback for old docs
      isRecurring: data.isRecurring || false,
      recurrence: data.recurrence || 'none',
      recurrenceEndDate: data.recurrenceEndDate && typeof data.recurrenceEndDate.toDate === 'function'
                         ? (data.recurrenceEndDate as Timestamp).toDate().toISOString().split('T')[0]
                         : undefined,
      tags: Array.isArray(data.tags) ? data.tags : [],
    };
  } catch (error) {
    console.error(`[firestore.mapExpense] Error mapping expense document ${docId}:`, error, docSnap.data());
    return null;
  }
}
 
 
// Group Management Functions
export async function uploadGroupImage(groupId: string, imageUri: string): Promise<string> {
  try {
    if (!imageUri) throw new Error("No image URI provided.");
 
    const response = await fetch(imageUri);
    const blob = await response.blob();
 
    const storageRef = ref(storage, `group-images/${groupId}`);
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);
 
    return downloadURL;
  } catch (error) {
    console.error("[firestore.uploadGroupImage] Error uploading group image: ", error);
    throw error;
  }
}
 
export async function createGroup(
  creatorProfile: UserProfile,
  groupName: string,
  initialMemberProfiles: UserProfile[],
  imageUrl: string | null
): Promise<string> {
  try {
    if (!groupName.trim()) throw new Error("Group name cannot be empty.");
    if (!initialMemberProfiles.some(p => p.uid === creatorProfile.uid)) {
      throw new Error("Creator must be part of the initial members.");
    }
 
    const memberIds = initialMemberProfiles.map(p => p.uid);
    const memberDetails: GroupMemberDetail[] = initialMemberProfiles.map(p => ({
      uid: p.uid,
      email: p.email,
      displayName: p.displayName || (p.email ? p.email.split('@')[0] : 'Unknown User'),
      role: p.uid === creatorProfile.uid ? 'creator' : 'member',
      profilePictureUrl: p.photoURL || null,
    }));
 
    const groupData = {
      name: groupName,
      createdBy: creatorProfile.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      memberIds: memberIds,
      memberDetails: memberDetails,
      imageUrl: imageUrl === undefined ? null : imageUrl,
    };
 
    const groupRef = await addDoc(collection(db, GROUPS_COLLECTION), groupData);
 
    await logGroupActivity(groupRef.id, {
      actorId: creatorProfile.uid,
      actorDisplayName: creatorProfile.displayName || creatorProfile.email || 'Unknown User',
      actionType: ActivityActionType.GROUP_CREATED,
      details: `created group "${groupName}"`,
    });
    for (const member of initialMemberProfiles) {
      if (member.uid !== creatorProfile.uid) {
         await logGroupActivity(groupRef.id, {
            actorId: creatorProfile.uid,
            actorDisplayName: creatorProfile.displayName || creatorProfile.email || 'Unknown User',
            actionType: ActivityActionType.MEMBER_ADDED,
            details: `added ${member.displayName || member.email || 'Unknown User'} to the group during creation`,
            relatedMemberId: member.uid,
            relatedMemberName: member.displayName || member.email || 'Unknown User',
        });
      }
    }
    return groupRef.id;
  } catch (error) {
    console.error("[firestore.createGroup] Error creating group: ", error);
    throw error;
  }
}

// Wallet Functions
export async function addFundsToWallet(userId: string, amount: number, currency: CurrencyCode): Promise<void> {
  try {
    if (!userId) throw new Error("User ID is required.");
    if (amount <= 0) throw new Error("Amount must be positive.");
    if (!SUPPORTED_CURRENCIES.some(c => c.code === currency)) throw new Error("Unsupported currency.");

    const userRef = doc(db, USERS_COLLECTION, userId);
    // Use dot notation for nested field update
    await updateDoc(userRef, {
      [`wallet.${currency}`]: increment(amount),
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("[firestore.addFundsToWallet] Error adding funds: ", error);
    throw error;
  }
}

export async function withdrawFundsFromWallet(userId: string, amount: number, currency: CurrencyCode): Promise<void> {
  try {
    if (!userId) throw new Error("User ID is required.");
    if (amount <= 0) throw new Error("Amount must be positive.");
    if (!SUPPORTED_CURRENCIES.some(c => c.code === currency)) throw new Error("Unsupported currency.");

    const userRef = doc(db, USERS_COLLECTION, userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error("User profile not found.");
    }
    
    const userData = userDoc.data();
    const currentBalance = userData.wallet?.[currency] || 0;
    
    if (currentBalance < amount) {
      throw new Error(`Insufficient funds. You have ${currentBalance} ${currency}, but trying to withdraw ${amount} ${currency}.`);
    }

    await updateDoc(userRef, {
      [`wallet.${currency}`]: increment(-amount),
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("[firestore.withdrawFundsFromWallet] Error withdrawing funds: ", error);
    throw error;
  }
}

export async function transferFundsBetweenUsers(
  fromUserId: string,
  toUserId: string,
  amount: number,
  currency: CurrencyCode
): Promise<void> {
  try {
    if (!fromUserId || !toUserId) throw new Error("Both user IDs are required.");
    if (amount <= 0) throw new Error("Amount must be positive.");
    if (!SUPPORTED_CURRENCIES.some(c => c.code === currency)) throw new Error("Unsupported currency.");

    await runTransaction(db, async (transaction) => {
      const fromUserRef = doc(db, USERS_COLLECTION, fromUserId);
      const toUserRef = doc(db, USERS_COLLECTION, toUserId);
      
      const fromUserDoc = await transaction.get(fromUserRef);
      const toUserDoc = await transaction.get(toUserRef);
      
      if (!fromUserDoc.exists()) {
        throw new Error("Sender's profile not found.");
      }
      if (!toUserDoc.exists()) {
        throw new Error("Recipient's profile not found.");
      }
      
      const fromUserData = fromUserDoc.data();
      const currentBalance = fromUserData.wallet?.[currency] || 0;
      
      if (currentBalance < amount) {
        throw new Error(`Insufficient funds. You have ${currentBalance} ${currency}, but trying to transfer ${amount} ${currency}.`);
      }

      // Deduct from sender
      transaction.update(fromUserRef, {
        [`wallet.${currency}`]: increment(-amount),
        updatedAt: Timestamp.now(),
      });

      // Add to recipient
      transaction.update(toUserRef, {
        [`wallet.${currency}`]: increment(amount),
        updatedAt: Timestamp.now(),
      });
    });
  } catch (error) {
    console.error("[firestore.transferFundsBetweenUsers] Error transferring funds: ", error);
    throw error;
  }
}