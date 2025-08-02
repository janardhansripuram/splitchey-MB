

'use server';
import { db, storage } from './config';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { collection, addDoc, query, where, getDocs, Timestamp, orderBy, limit, doc, getDoc, updateDoc, deleteDoc, writeBatch, runTransaction, arrayUnion, arrayRemove, setDoc, increment, onSnapshot } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { auth } from './config';
import { SUPPORTED_CURRENCIES, ActivityActionType, INVESTMENT_TYPES } from '@/lib/types';
import type { BlogPost, Expense, ExpenseFormData, UserProfile, FriendRequest, Friend, Group, GroupMemberDetail, SplitExpense, SplitParticipant, SplitMethod, Reminder, ReminderFormData, RecurrenceType, GroupActivityLogEntry, Budget, BudgetFormData, Income, IncomeFormData, CurrencyCode, SavingsGoal, SavingsGoalFormData, ContributionFormData, GoalContribution, SettlementStatus, BudgetPeriod, GroupInvitation, GroupSavingsGoal, GroupSavingsGoalFormData, GroupContributionFormData, GroupGoalContribution, GlobalCategory, FeatureFlags, BroadcastAnnouncement, Investment, InvestmentFormData, SiteContentFeatures, SiteContentFeature, MaintenanceModeSettings, SiteContentHero, SiteContentCTA, SiteContentFooter, SiteContentTestimonials, SiteContentFAQ, TestimonialItem, FAQItem, Notification, MonetizationSettings, UserSubscription, UserAchievement, ChatMessage, SiteContentMobileApp } from '@/lib/types';
import { startOfMonth, endOfMonth, formatISO, parseISO, startOfWeek, endOfWeek, startOfYear, endOfYear, subDays, startOfDay, format, eachDayOfInterval } from 'date-fns';
import { formatCurrencyDisplay } from '@/lib/utils';
import { processReferral, generateReferralCodeForUser } from './services/referrals';

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


function serializeFirestoreData(data: any): any {
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (data instanceof Timestamp) {
    return data.toDate().toISOString();
  }
  if (Array.isArray(data)) {
    return data.map(serializeFirestoreData);
  }
  
  const result: { [key: string]: any } = {};
  for (const key of Object.keys(data)) {
    result[key] = serializeFirestoreData(data[key]);
  }
  return result;
}


// Activity Log Functions (Helper, not directly exported usually)
async function logGroupActivity(
  groupId: string,
  activityData: Omit<GroupActivityLogEntry, 'id' | 'timestamp'> & { timestamp?: Timestamp } // Allow optional timestamp for direct creation
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

export async function getGroupActivityLog(groupId: string, limitCount: number = 20): Promise<GroupActivityLogEntry[]> {
  try {
    const logRef = collection(db, GROUPS_COLLECTION, groupId, ACTIVITY_LOG_SUBCOLLECTION);
    const q = query(logRef, orderBy('timestamp', 'desc'), limit(limitCount));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        timestamp: (data.timestamp as Timestamp).toDate().toISOString(),
      } as GroupActivityLogEntry;
    });
  } catch (error) {
    console.error(`Error fetching activity log for group ${groupId}:`, error);
    throw error;
  }
}


// Expense Functions
export async function addExpense(
  paidById: string, 
  expenseData: ExpenseFormData, 
  actorProfile: UserProfile,
  source?: 'manual' | 'ocr' | 'import'
): Promise<string> {
  try {
    if (!actorProfile?.uid) throw new Error("User ID of actor is required to add an expense.");
    if (!paidById) throw new Error("User ID of payer is required to add an expense.");
    
    let payerName = actorProfile.displayName || actorProfile.email;
    if (paidById !== actorProfile.uid) {
        const payerProfile = await getUserProfile(paidById);
        payerName = payerProfile?.displayName || payerProfile?.email || 'Unknown Payer';
    }

    const tagsArray = expenseData.tags ? expenseData.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '') : [];

    const expenseDoc: any = {
      userId: actorProfile.uid, // The user who "owns" this record
      paidById: paidById,
      paidByName: payerName,
      description: expenseData.description,
      amount: parseFloat(expenseData.amount),
      currency: expenseData.currency,
      category: expenseData.category,
      date: Timestamp.fromDate(parseISO(expenseData.date)),
      notes: expenseData.notes || '',
      receiptUrl: expenseData.receiptUrl || null,
      createdAt: Timestamp.now(),
      isRecurring: expenseData.isRecurring || false,
      recurrence: expenseData.recurrence || 'none',
      recurrenceEndDate: expenseData.recurrenceEndDate ? Timestamp.fromDate(parseISO(expenseData.recurrenceEndDate)) : null,
      tags: tagsArray,
    };

    if (expenseData.groupId && expenseData.groupName) {
      expenseDoc.groupId = expenseData.groupId;
      expenseDoc.groupName = expenseData.groupName;
    } else {
      expenseDoc.groupId = null;
      expenseDoc.groupName = null;
    }

    const docRef = await addDoc(collection(db, EXPENSES_COLLECTION), expenseDoc);

    // Track streaks and award achievements
    const expenseDate = new Date().toISOString().split('T')[0];
    const lastDate = actorProfile.lastExpenseDate;
    const streak = actorProfile.currentStreak || 0;
    
    if (lastDate !== expenseDate) {
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      const newStreak = lastDate === yesterday ? streak + 1 : 1;
      
      const userRef = doc(db, USERS_COLLECTION, actorProfile.uid);
      await updateDoc(userRef, {
        lastExpenseDate: expenseDate,
        currentStreak: newStreak,
      });

      if (newStreak === 7) await awardAchievement(actorProfile.uid, 'STREAK_7');
      if (newStreak === 30) await awardAchievement(actorProfile.uid, 'STREAK_30');
    }

    // Award first-time achievements
    await awardAchievement(actorProfile.uid, 'FIRST_EXPENSE');
    if(source === 'ocr') await awardAchievement(actorProfile.uid, 'AI_SCAN');
    // Check total expenses count
    const userExpenses = await getExpensesByUser(actorProfile.uid);
    if(userExpenses.length >= 50) await awardAchievement(actorProfile.uid, 'EXPENSE_50');


    if (expenseData.groupId && actorProfile) {
      const details = actorProfile.uid === paidById 
        ? `added expense "${expenseData.description}" to the group`
        : `added expense "${expenseData.description}" (paid by ${payerName}) to the group`;

      await logGroupActivity(expenseData.groupId, {
        actorId: actorProfile.uid,
        actorDisplayName: actorProfile.displayName || actorProfile.email,
        actionType: ActivityActionType.EXPENSE_ADDED_TO_GROUP,
        details: details,
        relatedExpenseId: docRef.id,
        relatedExpenseName: expenseData.description,
      });
    }
    return docRef.id;
  } catch (error) {
    console.error("[firestore.addExpense] Error adding document: ", error);
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

export async function getExpenseById(expenseId: string): Promise<Expense | null> {
  try {
    const docRef = doc(db, EXPENSES_COLLECTION, expenseId);
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
    const docRef = doc(db, EXPENSES_COLLECTION, expenseId);
    const updateData: { [key: string]: any } = {updatedAt: Timestamp.now()};

    if (expenseData.description !== undefined) updateData.description = expenseData.description;
    if (expenseData.amount !== undefined) updateData.amount = parseFloat(expenseData.amount);
    if (expenseData.currency !== undefined) updateData.currency = expenseData.currency;
    if (expenseData.category !== undefined) updateData.category = expenseData.category;
    if (expenseData.date !== undefined) updateData.date = Timestamp.fromDate(parseISO(expenseData.date));
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
      updateData.recurrenceEndDate = expenseData.recurrenceEndDate ? Timestamp.fromDate(parseISO(expenseData.recurrenceEndDate)) : null;
    }
    if (expenseData.tags !== undefined) {
      updateData.tags = expenseData.tags ? expenseData.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '') : [];
    }

    if (Object.keys(updateData).length > 1) {
        await updateDoc(docRef, updateData);
    }
  } catch (error) {
    console.error("[firestore.updateExpense] Error updating document: ", error);
    throw error;
  }
}


export async function deleteExpense(expenseId: string): Promise<void> {
  try {
    const docRef = doc(db, EXPENSES_COLLECTION, expenseId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("[firestore.deleteExpense] Error deleting document: ", error);
    throw error;
  }
}

export async function bulkDeleteExpenses(expenseIds: string[]): Promise<void> {
    if (expenseIds.length === 0) return;
    if (expenseIds.length > 500) {
        throw new Error("Cannot delete more than 500 expenses at a time.");
    }
    const batch = writeBatch(db);
    expenseIds.forEach(id => {
        const docRef = doc(db, EXPENSES_COLLECTION, id);
        batch.delete(docRef);
    });
    await batch.commit();
}

export async function bulkAddExpenses(userId: string, expenses: ExpenseFormData[]): Promise<void> {
    if (expenses.length === 0) return;
    if (expenses.length > 500) {
        throw new Error("Cannot add more than 500 expenses at a time.");
    }

    const batch = writeBatch(db);
    const expensesCollectionRef = collection(db, EXPENSES_COLLECTION);

    expenses.forEach(expenseData => {
        const docRef = doc(expensesCollectionRef); // Create a new doc with a unique ID
        const tagsArray = expenseData.tags ? expenseData.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '') : [];
        const expenseDoc = {
            userId,
            paidById: userId, // By default, importer is the payer
            description: expenseData.description,
            amount: parseFloat(expenseData.amount),
            currency: expenseData.currency,
            category: expenseData.category,
            date: Timestamp.fromDate(parseISO(expenseData.date)),
            notes: expenseData.notes || '',
            receiptUrl: expenseData.receiptUrl || null,
            createdAt: Timestamp.now(),
            isRecurring: expenseData.isRecurring || false,
            recurrence: expenseData.recurrence || 'none',
            recurrenceEndDate: expenseData.recurrenceEndDate ? Timestamp.fromDate(parseISO(expenseData.recurrenceEndDate)) : null,
            tags: tagsArray,
            groupId: null,
            groupName: null,
        };
        batch.set(docRef, expenseDoc);
    });

    await batch.commit();
}


export async function getExpensesByGroupId(groupId: string): Promise<Expense[]> {
  try {
    if (!groupId) return [];
    const q = query(
      collection(db, EXPENSES_COLLECTION),
      where('groupId', '==', groupId),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const expenses = querySnapshot.docs
      .map(mapExpenseDocumentToExpenseObject)
      .filter(expense => expense !== null) as Expense[];
    return expenses;
  } catch (error) {
    console.error("[firestore.getExpensesByGroupId] Error getting expenses by group ID: ", error);
    throw error;
  }
}

export async function getAllExpenses(): Promise<Expense[]> {
  try {
    const q = query(
      collection(db, EXPENSES_COLLECTION),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);

    const expenses = querySnapshot.docs
      .map(mapExpenseDocumentToExpenseObject)
      .filter(expense => expense !== null) as Expense[];
    return expenses;
  } catch (error: any) {
    console.error("[firestore.getAllExpenses] Error getting documents: ", error);
    throw error;
  }
}


// Income Functions
export async function addIncome(userId: string, incomeData: IncomeFormData): Promise<string> {
  try {
    if (!userId) throw new Error("User ID is required to add income.");
    const incomeDoc = {
      userId,
      source: incomeData.source,
      amount: parseFloat(incomeData.amount),
      currency: incomeData.currency || 'USD',
      date: Timestamp.fromDate(parseISO(incomeData.date)),
      notes: incomeData.notes || '',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isRecurring: incomeData.isRecurring || false,
      recurrence: incomeData.recurrence || 'none',
      recurrenceEndDate: incomeData.recurrenceEndDate ? Timestamp.fromDate(parseISO(incomeData.recurrenceEndDate)) : null,
    };
    const docRef = await addDoc(collection(db, INCOME_COLLECTION), incomeDoc);
    return docRef.id;
  } catch (error) {
    console.error("[firestore.addIncome] Error adding income: ", error);
    throw error;
  }
}

function mapIncomeDocumentToIncomeObject(docSnap: any): Income | null {
  const docId = docSnap.id;
  try {
    const data = docSnap.data();
    if (!data) {
      console.error(`[firestore.mapIncome] Income document ${docId} has no data.`);
      return null;
    }

    if (!data.date || typeof data.date.toDate !== 'function') {
      console.error(`[firestore.mapIncome] Income document ${docId} has invalid or missing 'date' field:`, data.date);
      return null;
    }
    if (!data.createdAt || typeof data.createdAt.toDate !== 'function') {
      console.error(`[firestore.mapIncome] Income document ${docId} has invalid or missing 'createdAt' field:`, data.createdAt);
      return null;
    }
     if (data.updatedAt && typeof data.updatedAt.toDate !== 'function') {
      console.warn(`[firestore.mapIncome] Income document ${docId} has invalid 'updatedAt' field:`, data.updatedAt);
      // Continue mapping, but updatedAt will be undefined
    }

    return {
      id: docId,
      userId: data.userId || 'Unknown User',
      source: data.source || 'Unknown Source',
      amount: typeof data.amount === 'number' ? data.amount : 0,
      currency: data.currency || 'USD',
      date: (data.date as Timestamp).toDate().toISOString().split('T')[0],
      notes: data.notes || '',
      createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      updatedAt: data.updatedAt && typeof data.updatedAt.toDate === 'function'
                 ? (data.updatedAt as Timestamp).toDate().toISOString()
                 : (data.createdAt as Timestamp).toDate().toISOString(),
      isRecurring: data.isRecurring || false,
      recurrence: data.recurrence || 'none',
      recurrenceEndDate: data.recurrenceEndDate && typeof data.recurrenceEndDate.toDate === 'function'
                         ? (data.recurrenceEndDate as Timestamp).toDate().toISOString().split('T')[0]
                         : undefined,
    };
  } catch (error) {
     console.error(`[firestore.mapIncome] Error mapping income document ${docId}:`, error, docSnap.data());
    return null;
  }
}

export async function getIncomeByUser(userId: string): Promise<Income[]> {
  try {
    if (!userId) return [];
    const q = query(
      collection(db, INCOME_COLLECTION),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map(mapIncomeDocumentToIncomeObject)
      .filter(income => income !== null) as Income[];
  } catch (error) {
    console.error("[firestore.getIncomeByUser] Error getting income: ", error);
    throw error;
  }
}

export async function getIncomeById(incomeId: string): Promise<Income | null> {
  try {
    const docRef = doc(db, INCOME_COLLECTION, incomeId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return mapIncomeDocumentToIncomeObject(docSnap);
    }
    return null;
  } catch (error) {
    console.error("[firestore.getIncomeById] Error getting income by ID: ", error);
    throw error;
  }
}

export async function updateIncome(incomeId: string, incomeData: Partial<IncomeFormData>): Promise<void> {
  try {
    const docRef = doc(db, INCOME_COLLECTION, incomeId);
    const updateData: { [key: string]: any } = { updatedAt: Timestamp.now() };

    if (incomeData.source !== undefined) updateData.source = incomeData.source;
    if (incomeData.amount !== undefined) updateData.amount = parseFloat(incomeData.amount);
    if (incomeData.currency !== undefined) updateData.currency = incomeData.currency;
    if (incomeData.date !== undefined) updateData.date = Timestamp.fromDate(parseISO(incomeData.date));
    if (incomeData.notes !== undefined) updateData.notes = incomeData.notes;
    if (incomeData.isRecurring !== undefined) updateData.isRecurring = incomeData.isRecurring;
    if (incomeData.recurrence !== undefined) updateData.recurrence = incomeData.recurrence;
    if (incomeData.recurrenceEndDate !== undefined) {
      updateData.recurrenceEndDate = incomeData.recurrenceEndDate ? Timestamp.fromDate(parseISO(incomeData.recurrenceEndDate)) : null;
    }

    if (Object.keys(updateData).length > 1) {
      await updateDoc(docRef, updateData);
    }
  } catch (error) {
    console.error("[firestore.updateIncome] Error updating income: ", error);
    throw error;
  }
}

export async function deleteIncome(incomeId: string): Promise<void> {
  try {
    const docRef = doc(db, INCOME_COLLECTION, incomeId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("[firestore.deleteIncome] Error deleting income: ", error);
    throw error;
  }
}


// User Profile Functions
export async function createUserProfile(
  userId: string,
  email: string | null,
  phoneNumber: string | null,
  displayName?: string | null,
  referralCode?: string | null
): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const docSnap = await getDoc(userRef);

    // Only create a profile if one doesn't already exist.
    if (!docSnap.exists()) {
      const { referralProgram } = await getFeatureFlags();
      const newReferralCode = referralProgram.isEnabled
        ? await generateReferralCodeForUser()
        : `disabled-${userId.substring(0, 4)}`;

      await setDoc(userRef, {
        uid: userId,
        email: email ? email.toLowerCase() : null,
        phoneNumber: phoneNumber || null,
        displayName: displayName || (email ? email.split('@')[0] : phoneNumber) || 'User',
        photoURL: null,
        defaultCurrency: 'USD' as CurrencyCode,
        language: 'en',
        wallet: {},
        role: email?.toLowerCase() === 'admin@splitchey.com' ? 'admin' : 'user',
        status: 'active',
        createdAt: Timestamp.now(),
        hasCompletedOnboarding: false,
        referralCode: newReferralCode,
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

      if (referralProgram.isEnabled && referralCode) {
        await processReferral(userId, email, referralCode, referralProgram);
      }
    }
  } catch (error) {
    console.error("[firestore.createUserProfile] Error creating user profile: ", error);
    throw error;
  }
}


export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        uid: data.uid,
        email: data.email,
        phoneNumber: data.phoneNumber || null,
        displayName: data.displayName,
        photoURL: data.photoURL || undefined,
        defaultCurrency: data.defaultCurrency || ('USD' as CurrencyCode),
        language: data.language || 'en',
        wallet: data.wallet || {},
        role: data.role || 'user',
        status: data.status || 'active',
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        hasCompletedOnboarding: data.hasCompletedOnboarding === undefined ? false : data.hasCompletedOnboarding,
        fcmTokens: data.fcmTokens || [],
        referralCode: data.referralCode || undefined,
        rewardPoints: data.rewardPoints || 0,
        currentStreak: data.currentStreak || 0,
        lastExpenseDate: data.lastExpenseDate || null,
        subscription: data.subscription || { plan: 'free', planId: 'free', status: 'active', startedAt: (data.createdAt as Timestamp).toDate().toISOString() },
      } as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("[firestore.getUserProfile] Error getting user profile: ", error);
    throw error;
  }
}

export async function markOnboardingAsCompleted(userId: string): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      hasCompletedOnboarding: true,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("[firestore.markOnboardingAsCompleted] Error updating user profile: ", error);
    throw error;
  }
}


export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const usersCollectionRef = collection(db, USERS_COLLECTION);
    const q = query(usersCollectionRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        photoURL: data.photoURL || undefined,
        defaultCurrency: data.defaultCurrency || ('USD' as CurrencyCode),
        wallet: data.wallet || {},
        role: data.role || 'user',
        status: data.status || 'active',
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      } as UserProfile;
    });
  } catch (error) {
    console.error("[firestore.getAllUsers] Error getting all users: ", error);
    throw error;
  }
}

export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  try {
    const q = query(collection(db, USERS_COLLECTION), where('email', '==', email.toLowerCase()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const data = querySnapshot.docs[0].data();
      return {
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        photoURL: data.photoURL || undefined,
        defaultCurrency: data.defaultCurrency || ('USD' as CurrencyCode),
        wallet: data.wallet || {},
        role: data.role || 'user',
        status: data.status || 'active',
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      } as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("[firestore.getUserByEmail] Error getting user by email: ", error);
    throw error;
  }
}

export async function getUserByPhoneNumber(phoneNumber: string): Promise<UserProfile | null> {
  try {
    const q = query(collection(db, USERS_COLLECTION), where('phoneNumber', '==', phoneNumber));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const data = querySnapshot.docs[0].data();
      return {
        uid: data.uid,
        email: data.email,
        phoneNumber: data.phoneNumber || null,
        displayName: data.displayName,
        photoURL: data.photoURL || undefined,
        defaultCurrency: data.defaultCurrency || ('USD' as CurrencyCode),
        wallet: data.wallet || {},
        role: data.role || 'user',
        status: data.status || 'active',
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      } as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("[firestore.getUserByPhoneNumber] Error getting user by phone number: ", error);
    throw error;
  }
}

export async function updateUserProfile(userId: string, data: Partial<Pick<UserProfile, 'displayName' | 'defaultCurrency' | 'language'>>): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const updateData: { [key: string]: any } = {};

    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.defaultCurrency !== undefined) updateData.defaultCurrency = data.defaultCurrency;
    if (data.language !== undefined) updateData.language = data.language;

    if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = Timestamp.now();
        await updateDoc(userRef, updateData);
    }
  } catch (error) {
    console.error("[firestore.updateUserProfile] Error updating user profile: ", error);
    throw error;
  }
}

export async function updateUserProfilePhoto(userId: string, photoDataUri: string): Promise<string> {
    if (!photoDataUri) throw new Error("No photo data URI provided.");

    const storageRef = ref(storage, `profile-pictures/${userId}`);
    
    const uploadResult = await uploadString(storageRef, photoDataUri, 'data_url');
    const downloadURL = await getDownloadURL(uploadResult.ref);

    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, { photoURL: downloadURL, updatedAt: Timestamp.now() });

    if (auth.currentUser && auth.currentUser.uid === userId) {
        await updateProfile(auth.currentUser, { photoURL: downloadURL });
    }
  
    return downloadURL;
}

export async function saveUserFcmToken(userId: string, token: string): Promise<void> {
  if (!userId || !token) return;
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      fcmTokens: arrayUnion(token),
    });
  } catch (error) {
    console.error("[firestore.saveUserFcmToken] Error saving FCM token: ", error);
  }
}

export async function updateUserRole(userId: string, newRole: 'admin' | 'user'): Promise<void> {
  try {
    if (!userId || !newRole) {
      throw new Error("User ID and new role are required.");
    }
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      role: newRole,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error(`[firestore.updateUserRole] Error updating role for user ${userId}:`, error);
    throw error;
  }
}

export async function updateUserStatus(userId: string, newStatus: 'active' | 'suspended'): Promise<void> {
  try {
    if (!userId || !newStatus) {
      throw new Error("User ID and new status are required.");
    }
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      status: newStatus,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error(`[firestore.updateUserStatus] Error updating status for user ${userId}:`, error);
    throw error;
  }
}

export async function deleteUserProfile(userId: string): Promise<void> {
  try {
    if (!userId) {
      throw new Error("User ID is required.");
    }
    const userRef = doc(db, USERS_COLLECTION, userId);
    await deleteDoc(userRef);
  } catch (error) {
    console.error(`[firestore.deleteUserProfile] Error deleting user profile for user ${userId}:`, error);
    throw error;
  }
}

export async function upgradeUserToPremium(userId: string, period: 'monthly' | 'yearly'): Promise<void> {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const now = new Date();
    const periodEnd = new Date(now);

    if (period === 'monthly') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }
    
    const subscriptionUpdate: UserSubscription = {
        plan: 'premium',
        planId: `premium_${period}`,
        status: 'active',
        startedAt: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
    };
    
    await updateDoc(userRef, { subscription: subscriptionUpdate });
}

export async function cancelUserSubscription(userId: string): Promise<void> {
    const userRef = doc(db, USERS_COLLECTION, userId);
    
    const freeSubscriptionUpdate: UserSubscription = {
        plan: 'free',
        planId: 'free',
        status: 'active',
        startedAt: new Date().toISOString(),
        currentPeriodEnd: undefined,
    };

    const updatePayload = {
        subscription: freeSubscriptionUpdate
    };

    await updateDoc(userRef, updatePayload);
}

// Achievement Functions
export async function awardAchievement(userId: string, achievementId: string): Promise<void> {
    try {
        if (!userId || !achievementId) return;

        const achievementRef = doc(db, USERS_COLLECTION, userId, ACHIEVEMENTS_SUBCOLLECTION, achievementId);
        const docSnap = await getDoc(achievementRef);

        if (docSnap.exists()) {
            return; // Achievement already awarded
        }
        
        const ALL_ACHIEVEMENTS = (await import('@/lib/achievements')).ALL_ACHIEVEMENTS;
        const achievement = ALL_ACHIEVEMENTS.find(a => a.id === achievementId);

        if (!achievement) {
            console.warn(`[firestore.awardAchievement] Invalid achievement ID: ${achievementId}`);
            return;
        }

        const batch = writeBatch(db);

        // Award the achievement
        batch.set(achievementRef, { earnedAt: Timestamp.now() });

        // Award points
        if (achievement.points > 0) {
            const userRef = doc(db, USERS_COLLECTION, userId);
            batch.update(userRef, { rewardPoints: increment(achievement.points) });
        }
        
        await batch.commit();

        // Create a notification
        const notificationsCollectionRef = collection(db, NOTIFICATIONS_COLLECTION);
        await addDoc(notificationsCollectionRef, {
            toUserId: userId,
            fromUserId: 'system',
            fromUserName: 'SplitChey',
            type: 'ACHIEVEMENT_UNLOCKED',
            title: `Achievement Unlocked: ${achievement.name}!`,
            body: `You've earned ${achievement.points} points. Keep up the great work!`,
            link: '/achievements',
            isRead: false,
            createdAt: Timestamp.now(),
        });

    } catch (error) {
        console.error(`[firestore.awardAchievement] Error awarding achievement ${achievementId} to user ${userId}:`, error);
        // Don't throw, as this is a non-critical background task
    }
}

export async function getAchievementsForUser(userId: string): Promise<UserAchievement[]> {
  try {
    if (!userId) return [];
    const achievementsRef = collection(db, USERS_COLLECTION, userId, ACHIEVEMENTS_SUBCOLLECTION);
    const q = query(achievementsRef, orderBy('earnedAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        earnedAt: (data.earnedAt as Timestamp).toDate().toISOString(),
      } as UserAchievement;
    });
  } catch (error) {
    console.error("[firestore.getAchievementsForUser] Error getting achievements:", error);
    throw error;
  }
}

// Friend Management Functions
export async function sendFriendRequest(fromUserId: string, fromUserEmail: string | null, fromUserDisplayName: string | undefined, identifier: string, type?: 'email' | 'phone'): Promise<{success: boolean, message: string}> {
  try {
    let toUser: UserProfile | null = null;
    const fromUser = await getUserProfile(fromUserId);

    if (!fromUser) {
      return { success: false, message: "Could not identify the sender." };
    }
    
    if (type === 'email' || !type) { // Default to email
      if (fromUser.email?.toLowerCase() === identifier.toLowerCase()) {
        return { success: false, message: "You cannot send a friend request to yourself." };
      }
      toUser = await getUserByEmail(identifier);
    } else { // type === 'phone'
      if (fromUser.phoneNumber === identifier) {
        return { success: false, message: "You cannot send a friend request to yourself." };
      }
      toUser = await getUserByPhoneNumber(identifier);
    }

    if (!toUser) {
      return { success: false, message: `User with this ${type || 'email'} does not exist.` };
    }
    const toUserId = toUser.uid;

    const friendDoc = await getDoc(doc(db, USERS_COLLECTION, fromUserId, FRIENDS_SUBCOLLECTION, toUserId));
    if (friendDoc.exists()) {
      return { success: false, message: "You are already friends with this user." };
    }

    const q1 = query(collection(db, FRIEND_REQUESTS_COLLECTION),
      where('fromUserId', '==', fromUserId),
      where('toUserId', '==', toUserId),
      where('status', '==', 'pending'));
    const existingReq1 = await getDocs(q1);
    if (!existingReq1.empty) {
       return { success: false, message: "A friend request to this user is already pending." };
    }

    const q2 = query(collection(db, FRIEND_REQUESTS_COLLECTION),
      where('fromUserId', '==', toUserId),
      where('toUserId', '==', fromUserId),
      where('status', '==', 'pending'));
    const existingReq2 = await getDocs(q2);
     if (!existingReq2.empty) {
       return { success: false, message: "This user has already sent you a friend request. Check your incoming requests." };
    }

    await addDoc(collection(db, FRIEND_REQUESTS_COLLECTION), {
      fromUserId,
      fromUserEmail: fromUser.email || null,
      fromUserDisplayName: fromUser.displayName || fromUser.email?.split('@')[0] || fromUser.phoneNumber,
      toUserId,
      toUserEmail: toUser.email || null,
      toUserPhoneNumber: toUser.phoneNumber || null,
      status: 'pending',
      createdAt: Timestamp.now(),
    });
    return { success: true, message: "Friend request sent successfully." };
  } catch (error) {
    console.error("[firestore.sendFriendRequest] Error sending friend request: ", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return { success: false, message: `Failed to send friend request: ${errorMessage}` };
  }
}

export async function getIncomingFriendRequests(userId: string): Promise<FriendRequest[]> {
  try {
    if (!userId) {
      return [];
    }
    const q = query(
      collection(db, FRIEND_REQUESTS_COLLECTION),
      where('toUserId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        } as FriendRequest
    });
  } catch (error) {
    console.error("[firestore.getIncomingFriendRequests] Error getting incoming friend requests: ", error);
    throw error;
  }
}

export async function acceptFriendRequest(requestId: string, fromUserProfile: UserProfile, toUserProfile: UserProfile): Promise<void> {
  const requestRef = doc(db, FRIEND_REQUESTS_COLLECTION, requestId);

  await runTransaction(db, async (transaction) => {
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists()) {
      throw new Error("Friend request does not exist or has been already processed.");
    }
    const requestData = requestSnap.data() as Omit<FriendRequest, 'id' | 'createdAt'> & {createdAt: Timestamp};
    if (requestData.status !== 'pending') {
      throw new Error("Friend request is not pending.");
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

    const fromUserFriendRef = doc(db, USERS_COLLECTION, fromUserProfile.uid, FRIENDS_SUBCOLLECTION, toUserProfile.uid);
    const toUserFriendRef = doc(db, USERS_COLLECTION, toUserProfile.uid, FRIENDS_SUBCOLLECTION, fromUserProfile.uid);

    transaction.set(fromUserFriendRef, friendDataForFromUser);
    transaction.set(toUserFriendRef, friendDataForToUser);
    transaction.delete(requestRef);
  });
}


export async function rejectFriendRequest(requestId: string): Promise<void> {
  try {
    const requestRef = doc(db, FRIEND_REQUESTS_COLLECTION, requestId);
    await deleteDoc(requestRef);
  } catch (error) {
    console.error("[firestore.rejectFriendRequest] Error rejecting friend request: ", error);
    throw error;
  }
}

export async function getFriends(userId: string): Promise<Friend[]> {
  try {
    if (!userId) return [];
    const friendsCollectionRef = collection(db, USERS_COLLECTION, userId, FRIENDS_SUBCOLLECTION);
    const q = query(friendsCollectionRef, orderBy('displayName', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            ...data,
            uid: docSnap.id,
            addedAt: (data.addedAt as Timestamp).toDate().toISOString(),
        } as Friend
    });
  } catch (error) {
    console.error("[firestore.getFriends] Error getting friends: ", error);
    throw error;
  }
}

export async function removeFriend(currentUserId: string, friendUserId: string): Promise<void> {
  const batch = writeBatch(db);
  const currentUserFriendRef = doc(db, USERS_COLLECTION, currentUserId, FRIENDS_SUBCOLLECTION, friendUserId);
  const friendUserFriendRef = doc(db, USERS_COLLECTION, friendUserId, FRIENDS_SUBCOLLECTION, currentUserId);

  batch.delete(currentUserFriendRef);
  batch.delete(friendUserFriendRef);

  try {
    await batch.commit();
  } catch (error) {
    console.error("[firestore.removeFriend] Error removing friend: ", error);
    throw error;
  }
}

// Group Management Functions
export async function createGroup(
  creatorProfile: UserProfile,
  groupName: string,
  initialMemberProfiles: UserProfile[]
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
      displayName: p.displayName || p.email.split('@')[0],
      role: p.uid === creatorProfile.uid ? 'creator' : 'member'
    }));

    const groupData = {
      name: groupName,
      createdBy: creatorProfile.uid,
      createdAt: Timestamp.now(),
      memberIds: memberIds,
      memberDetails: memberDetails,
    };

    const groupRef = await addDoc(collection(db, GROUPS_COLLECTION), groupData);

    await logGroupActivity(groupRef.id, {
      actorId: creatorProfile.uid,
      actorDisplayName: creatorProfile.displayName || creatorProfile.email,
      actionType: ActivityActionType.GROUP_CREATED,
      details: `created group "${groupName}"`,
    });
    for (const member of initialMemberProfiles) {
      if (member.uid !== creatorProfile.uid) {
         await logGroupActivity(groupRef.id, {
            actorId: creatorProfile.uid,
            actorDisplayName: creatorProfile.displayName || creatorProfile.email,
            actionType: ActivityActionType.MEMBER_ADDED,
            details: `added ${member.displayName || member.email} to the group during creation`,
            relatedMemberId: member.uid,
            relatedMemberName: member.displayName || member.email,
        });
      }
    }
    return groupRef.id;
  } catch (error) {
    console.error("[firestore.createGroup] Error creating group: ", error);
    throw error;
  }
}

export async function getGroupsForUser(userId: string): Promise<Group[]> {
  try {
    if (!userId) return [];
    const q = query(
      collection(db, GROUPS_COLLECTION),
      where('memberIds', 'array-contains', userId)
    );
    const querySnapshot = await getDocs(q);
    const groups = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            name: data.name,
            createdBy: data.createdBy,
            memberIds: data.memberIds || [],
            memberDetails: data.memberDetails || [],
            imageUrl: data.imageUrl || undefined,
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
            updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate().toISOString() : undefined,
        } as Group
    });
    groups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return groups;
  } catch (error) {
    console.error("[firestore.getGroupsForUser] Error getting groups for user: ", error);
    throw error;
  }
}

export async function getGroupDetails(groupId: string): Promise<Group | null> {
  try {
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);
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
          createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
          updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate().toISOString() : undefined,
      } as Group;
    }
    return null;
  } catch (error) {
    console.error("[firestore.getGroupDetails] Error getting group details: ", error);
    throw error;
  }
}

export async function updateGroupImageUrl(groupId: string, imageUrl: string): Promise<void> {
  try {
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);
    await updateDoc(groupRef, {
      imageUrl: imageUrl,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("[firestore.updateGroupImageUrl] Error updating group image URL: ", error);
    throw error;
  }
}

export async function updateGroupDetails(
  groupId: string,
  actorProfile: UserProfile,
  data: { name?: string }
): Promise<void> {
  try {
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);
    const batch = writeBatch(db);

    const groupSnap = await getDoc(groupRef);
    if (!groupSnap.exists()) throw new Error("Group not found for update.");
    const existingGroupData = groupSnap.data() as Group;

    const updateData: { [key: string]: any } = { ...data, updatedAt: Timestamp.now() };
    batch.update(groupRef, updateData);

    if (data.name && existingGroupData.name !== data.name) {
      // Update groupName in associated expenses
      const expensesQuery = query(collection(db, EXPENSES_COLLECTION), where('groupId', '==', groupId));
      const expensesSnapshot = await getDocs(expensesQuery);
      expensesSnapshot.forEach(expenseDoc => {
        batch.update(expenseDoc.ref, { groupName: data.name });
      });

      await logGroupActivity(groupId, {
        actorId: actorProfile.uid,
        actorDisplayName: actorProfile.displayName || actorProfile.email,
        actionType: ActivityActionType.GROUP_NAME_UPDATED,
        details: `changed group name from "${existingGroupData.name}" to "${data.name}"`,
        previousValue: existingGroupData.name,
        newValue: data.name,
      });
    }
    await batch.commit();
  } catch (error) {
    console.error("[firestore.updateGroupDetails] Error updating group details:", error);
    throw error;
  }
}

export async function addMembersToGroup(
  groupId: string,
  actorProfile: UserProfile,
  newMemberProfiles: UserProfile[]
): Promise<void> {
  try {
    if (newMemberProfiles.length === 0) return;
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);

    await runTransaction(db, async (transaction) => {
      const groupSnap = await transaction.get(groupRef);
      if (!groupSnap.exists()) throw new Error("Group not found.");

      const groupData = groupSnap.data() as Group;
      const existingMemberIds = new Set(groupData.memberIds);

      const membersToAddDetails: GroupMemberDetail[] = [];
      const memberIdsToAdd: string[] = [];

      for (const profile of newMemberProfiles) {
        if (!existingMemberIds.has(profile.uid)) {
          memberIdsToAdd.push(profile.uid);
          membersToAddDetails.push({
            uid: profile.uid,
            email: profile.email,
            displayName: profile.displayName || profile.email.split('@')[0],
            role: 'member'
          });
          // Log activity inside the transaction for each member added
          await logGroupActivity(groupId, {
            actorId: actorProfile.uid,
            actorDisplayName: actorProfile.displayName || actorProfile.email,
            actionType: ActivityActionType.MEMBER_ADDED,
            details: `added ${profile.displayName || profile.email} to the group`,
            relatedMemberId: profile.uid,
            relatedMemberName: profile.displayName || profile.email,
        });
        }
      }

      if (memberIdsToAdd.length > 0) {
        transaction.update(groupRef, {
          memberIds: arrayUnion(...memberIdsToAdd),
          memberDetails: arrayUnion(...membersToAddDetails),
          updatedAt: Timestamp.now()
        });
      }
    });
  } catch (error) {
    console.error("[firestore.addMembersToGroup] Error adding members to group:", error);
    throw error;
  }
}

export async function removeMemberFromGroup(
  groupId: string,
  actorProfile: UserProfile,
  memberIdToRemove: string,
  memberDisplayNameToRemove: string
): Promise<void> {
   try {
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);

    await runTransaction(db, async (transaction) => {
      const groupSnap = await transaction.get(groupRef);
      if (!groupSnap.exists()) throw new Error("Group not found.");

      const groupData = groupSnap.data() as Group;
      const memberDetailToRemove = groupData.memberDetails.find(m => m.uid === memberIdToRemove);

      if (!memberDetailToRemove && groupData.memberIds.includes(memberIdToRemove)) {
         console.warn(`[firestore.removeMemberFromGroup] Member detail for UID ${memberIdToRemove} not found in group ${groupId}, but ID was in memberIds. Proceeding with ID removal.`);
      }

      let isDeletingGroup = false;
      if (groupData.memberIds.length === 1 && groupData.memberIds.includes(memberIdToRemove)) {
        isDeletingGroup = true;
        transaction.delete(groupRef);
      } else {
        const updatePayload: { memberIds: any, memberDetails?: any, updatedAt: Timestamp } = {
            memberIds: arrayRemove(memberIdToRemove),
            updatedAt: Timestamp.now()
        };
        if (memberDetailToRemove) {
            updatePayload.memberDetails = arrayRemove(memberDetailToRemove);
        }
        transaction.update(groupRef, updatePayload);
      }

      // Logging logic
      let actionType = ActivityActionType.MEMBER_REMOVED;
      let details = `${actorProfile.displayName || actorProfile.email} removed ${memberDisplayNameToRemove} from the group "${groupData.name}"`;

      if (actorProfile.uid === memberIdToRemove) { // User is leaving
        actionType = ActivityActionType.MEMBER_LEFT;
        details = `${actorProfile.displayName || actorProfile.email} left the group "${groupData.name}"`;
      }

      if (isDeletingGroup) {
        actionType = ActivityActionType.GROUP_DELETED;
        details = `Group "${groupData.name}" was deleted as the last member (${actorProfile.displayName || actorProfile.email}) left.`;
      }

      await logGroupActivity(groupId, {
        actorId: actorProfile.uid,
        actorDisplayName: actorProfile.displayName || actorProfile.email,
        actionType: actionType,
        details: details,
        relatedMemberId: memberIdToRemove,
        relatedMemberName: memberDisplayNameToRemove,
      });
    });
  } catch (error) {
    console.error("[firestore.removeMemberFromGroup] Error removing member from group:", error);
    throw error;
  }
}

export async function deleteGroup(groupId: string, actorId: string): Promise<void> {
  const groupRef = doc(db, GROUPS_COLLECTION, groupId);
  const groupDoc = await getDoc(groupRef);

  if (!groupDoc.exists()) {
    throw new Error("Group not found.");
  }

  const groupData = groupDoc.data();
  if (groupData.createdBy !== actorId) {
    throw new Error("Only the group creator can delete the group.");
  }

  const batch = writeBatch(db);

  // Un-group associated expenses
  const expensesQuery = query(collection(db, EXPENSES_COLLECTION), where('groupId', '==', groupId));
  const expensesSnapshot = await getDocs(expensesQuery);
  expensesSnapshot.forEach(doc => {
    batch.update(doc.ref, { groupId: null, groupName: null });
  });

  // Note: Associated splits are intentionally not deleted here to preserve debt history for all users.
  // They will simply have a dangling groupId. A more complex cleanup could be a future enhancement.

  // Delete the group document
  batch.delete(groupRef);

  await batch.commit();
}


export async function updateMemberRole(groupId: string, actorProfile: UserProfile, memberId: string, newRole: 'admin' | 'member'): Promise<void> {
  const groupRef = doc(db, GROUPS_COLLECTION, groupId);
  return runTransaction(db, async (transaction) => {
    const groupDoc = await transaction.get(groupRef);
    if (!groupDoc.exists()) throw new Error("Group not found.");

    const groupData = groupDoc.data() as Group;
    const actor = groupData.memberDetails.find(m => m.uid === actorProfile.uid);
    if (actor?.role !== 'creator' && actor?.role !== 'admin') throw new Error("Only admins or the creator can change roles.");
    if (actor?.role === 'admin' && groupData.createdBy === memberId) throw new Error("Admins cannot change the creator's role.");
    
    const memberIndex = groupData.memberDetails.findIndex(m => m.uid === memberId);
    if (memberIndex === -1) throw new Error("Member not found in group.");
    if (groupData.memberDetails[memberIndex].role === 'creator') throw new Error("Cannot change the creator's role.");
    
    const oldRole = groupData.memberDetails[memberIndex].role;
    groupData.memberDetails[memberIndex].role = newRole;

    transaction.update(groupRef, { memberDetails: groupData.memberDetails, updatedAt: Timestamp.now() });

    await logGroupActivity(groupId, {
        actorId: actorProfile.uid,
        actorDisplayName: actorProfile.displayName || actorProfile.email,
        actionType: ActivityActionType.MEMBER_ROLE_UPDATED,
        details: `changed the role of ${groupData.memberDetails[memberIndex].displayName} from ${oldRole} to ${newRole}`,
        relatedMemberId: memberId,
        relatedMemberName: groupData.memberDetails[memberIndex].displayName,
        previousValue: oldRole,
        newValue: newRole
    });
  });
}

export async function transferGroupOwnership(groupId: string, actorProfile: UserProfile, newCreatorId: string): Promise<void> {
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);
    return runTransaction(db, async (transaction) => {
        const groupDoc = await transaction.get(groupRef);
        if (!groupDoc.exists()) throw new Error("Group not found.");
        
        const groupData = groupDoc.data() as Group;
        if (groupData.createdBy !== actorProfile.uid) throw new Error("Only the current creator can transfer ownership.");
        
        const oldCreatorIndex = groupData.memberDetails.findIndex(m => m.uid === actorProfile.uid);
        const newCreatorIndex = groupData.memberDetails.findIndex(m => m.uid === newCreatorId);

        if (newCreatorIndex === -1) throw new Error("New owner is not a member of the group.");
        if (groupData.memberDetails[newCreatorIndex].role !== 'admin') throw new Error("Ownership can only be transferred to an admin.");

        // Change roles
        if (oldCreatorIndex !== -1) {
            groupData.memberDetails[oldCreatorIndex].role = 'admin';
        }
        groupData.memberDetails[newCreatorIndex].role = 'creator';

        transaction.update(groupRef, {
            createdBy: newCreatorId,
            memberDetails: groupData.memberDetails,
            updatedAt: Timestamp.now()
        });
        
        await logGroupActivity(groupId, {
            actorId: actorProfile.uid,
            actorDisplayName: actorProfile.displayName || actorProfile.email,
            actionType: ActivityActionType.GROUP_OWNERSHIP_TRANSFERRED,
            details: `transferred group ownership to ${groupData.memberDetails[newCreatorIndex].displayName}`,
            relatedMemberId: newCreatorId,
            relatedMemberName: groupData.memberDetails[newCreatorIndex].displayName
        });
    });
}

// Group Invitation Functions
export async function sendGroupInvitation(groupId: string, groupName: string, inviterProfile: UserProfile, inviteeEmail: string): Promise<{ success: boolean; message: string; }> {
  const normalizedInviteeEmail = inviteeEmail.toLowerCase();
  const normalizedInviterEmail = inviterProfile.email.toLowerCase();
  if (normalizedInviteeEmail === normalizedInviterEmail) {
    return { success: false, message: "You cannot invite yourself to a group." };
  }

  const invitee = await getUserByEmail(normalizedInviteeEmail);
  if (!invitee) {
    return { success: false, message: "No user found with this email address." };
  }

  const groupDoc = await getDoc(doc(db, GROUPS_COLLECTION, groupId));
  if (!groupDoc.exists()) {
    return { success: false, message: "Group not found." };
  }
  if (groupDoc.data().memberIds.includes(invitee.uid)) {
    return { success: false, message: "This user is already a member of the group." };
  }

  const existingInviteQuery = query(
    collection(db, GROUP_INVITATIONS_COLLECTION),
    where("groupId", "==", groupId),
    where("inviteeEmail", "==", normalizedInviteeEmail),
    where("status", "==", "pending")
  );
  const existingInviteSnap = await getDocs(existingInviteQuery);
  if (!existingInviteSnap.empty) {
    return { success: false, message: "An invitation to this group has already been sent to this user." };
  }

  await addDoc(collection(db, GROUP_INVITATIONS_COLLECTION), {
    groupId,
    groupName,
    inviterId: inviterProfile.uid,
    inviterDisplayName: inviterProfile.displayName || inviterProfile.email,
    inviteeEmail: normalizedInviteeEmail,
    status: 'pending',
    createdAt: Timestamp.now(),
  });

  return { success: true, message: "Invitation sent." };
}

export async function createGroupInviteLink(groupId: string, groupName: string, inviterProfile: UserProfile): Promise<string> {
  const token = doc(collection(db, 'dummy')).id; // Generate a unique ID to use as a token
  
  await addDoc(collection(db, GROUP_INVITATIONS_COLLECTION), {
    groupId,
    groupName,
    inviterId: inviterProfile.uid,
    inviterDisplayName: inviterProfile.displayName || inviterProfile.email,
    token: token,
    status: 'pending',
    createdAt: Timestamp.now(),
  });

  return token;
}

export async function getInvitationByToken(token: string): Promise<GroupInvitation | null> {
  const q = query(
    collection(db, GROUP_INVITATIONS_COLLECTION),
    where("token", "==", token),
    where("status", "==", "pending")
  );
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    return null;
  }

  const docSnap = querySnapshot.docs[0];
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
  } as GroupInvitation;
}

export async function acceptGroupInvitationByToken(token: string, acceptingUserProfile: UserProfile): Promise<{ success: boolean; message: string; groupId?: string; }> {
  let groupId = '';
  let groupName = '';
  
  try {
    await runTransaction(db, async (transaction) => {
      const inviteQuery = query(collection(db, GROUP_INVITATIONS_COLLECTION), where("token", "==", token), where("status", "==", "pending"));
      const inviteSnap = await getDocs(inviteQuery);

      if (inviteSnap.empty) {
        throw new Error("Invitation is invalid or has already been used.");
      }
      
      const inviteRef = inviteSnap.docs[0].ref;
      const invitation = inviteSnap.docs[0].data() as GroupInvitation;
      groupId = invitation.groupId; // capture for logging and return value
      groupName = invitation.groupName;

      const groupRef = doc(db, GROUPS_COLLECTION, invitation.groupId);
      const groupDoc = await transaction.get(groupRef);

      if (!groupDoc.exists()) {
        transaction.delete(inviteRef); // Clean up invalid invite
        throw new Error("The group associated with this invitation no longer exists.");
      }

      const groupData = groupDoc.data() as Group;
      if (groupData.memberIds.includes(acceptingUserProfile.uid)) {
        transaction.delete(inviteRef); // Clean up the used invite
        // Not an error, just means they are already in.
        return; 
      }
      
      const newMemberDetail: GroupMemberDetail = {
        uid: acceptingUserProfile.uid,
        email: acceptingUserProfile.email,
        displayName: acceptingUserProfile.displayName || acceptingUserProfile.email.split('@')[0],
        role: 'member',
      };

      transaction.update(groupRef, {
        memberIds: arrayUnion(acceptingUserProfile.uid),
        memberDetails: arrayUnion(newMemberDetail),
      });

      // It's a single-use link, so delete it.
      transaction.delete(inviteRef);
    });

    // Log activity after transaction succeeds
    if (groupId) { // Only log if we successfully got a groupId
        await logGroupActivity(groupId, {
          actorId: acceptingUserProfile.uid,
          actorDisplayName: acceptingUserProfile.displayName || acceptingUserProfile.email,
          actionType: ActivityActionType.MEMBER_ADDED,
          details: `joined the group "${groupName}" via an invitation link`,
        });
    }

    return { success: true, message: "Successfully joined the group.", groupId };

  } catch (error) {
    console.error("[firestore.acceptGroupInvitationByToken] Error: ", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return { success: false, message: errorMessage };
  }
}

export async function getGroupInvitationsForUser(userEmail: string | null): Promise<GroupInvitation[]> {
  try {
    if (!userEmail) {
        return [];
    }
    const q = query(
      collection(db, GROUP_INVITATIONS_COLLECTION),
      where('inviteeEmail', '==', userEmail.toLowerCase()),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      } as GroupInvitation;
    });
  } catch (error) {
    console.error("[firestore.getGroupInvitationsForUser] Error getting group invitations: ", error);
    throw error;
  }
}

export async function acceptGroupInvitation(invitation: GroupInvitation, acceptingUserProfile: UserProfile): Promise<void> {
  const groupRef = doc(db, GROUPS_COLLECTION, invitation.groupId);
  const inviteRef = doc(db, GROUP_INVITATIONS_COLLECTION, invitation.id);

  await runTransaction(db, async (transaction) => {
    const groupDoc = await transaction.get(groupRef);
    if (!groupDoc.exists()) {
      throw new Error("The group no longer exists.");
    }
    const groupData = groupDoc.data() as Group;
    if (groupData.memberIds.includes(acceptingUserProfile.uid)) {
      transaction.delete(inviteRef); // User is already a member, just clean up the invite
      throw new Error("You are already a member of this group.");
    }

    const newMemberDetail: GroupMemberDetail = {
      uid: acceptingUserProfile.uid,
      email: acceptingUserProfile.email,
      displayName: acceptingUserProfile.displayName || acceptingUserProfile.email.split('@')[0],
      role: 'member',
    };

    transaction.update(groupRef, {
      memberIds: arrayUnion(acceptingUserProfile.uid),
      memberDetails: arrayUnion(newMemberDetail),
    });

    transaction.delete(inviteRef);
  });
  
  await logGroupActivity(invitation.groupId, {
      actorId: acceptingUserProfile.uid,
      actorDisplayName: acceptingUserProfile.displayName || acceptingUserProfile.email,
      actionType: ActivityActionType.MEMBER_ADDED,
      details: `joined the group by accepting an invitation from ${invitation.inviterDisplayName}`,
  });
}

export async function rejectGroupInvitation(invitationId: string): Promise<void> {
  const inviteRef = doc(db, GROUP_INVITATIONS_COLLECTION, invitationId);
  await deleteDoc(inviteRef);
}


// Split Expense Functions
type CreateSplitExpenseData = {
  originalExpenseId: string;
  originalExpenseDescription: string;
  currency: CurrencyCode;
  splitMethod: SplitMethod;
  totalAmount: number;
  paidBy: string;
  participants: SplitParticipant[];
  groupId?: string | null;
  groupName?: string | null;
  notes?: string;
  actorProfile?: UserProfile;
};

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

export async function getSplitExpensesForUser(userId: string): Promise<SplitExpense[]> {
  try {
    if (!userId) return [];
    const q = query(
      collection(db, SPLIT_EXPENSES_COLLECTION),
      where('involvedUserIds', 'array-contains', userId)
    );
    const querySnapshot = await getDocs(q);
    const splits = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            ...data,
            currency: data.currency || 'USD',
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
            updatedAt: (data.updatedAt as Timestamp).toDate().toISOString(),
        } as SplitExpense
    });
    splits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return splits;
  } catch (error) {
    console.error("[firestore.getSplitExpensesForUser] Error getting split expenses for user: ", error);
    throw error;
  }
}

export async function getSplitExpenseById(splitExpenseId: string): Promise<SplitExpense | null> {
  try {
    const docRef = doc(db, SPLIT_EXPENSES_COLLECTION, splitExpenseId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        currency: data.currency || 'USD',
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        updatedAt: (data.updatedAt as Timestamp).toDate().toISOString(),
      } as SplitExpense;
    }
    return null;
  } catch (error) {
    console.error("[firestore.getSplitExpenseById] Error getting split expense by ID: ", error);
    throw error;
  }
}

export async function getSplitExpensesByGroupId(groupId: string): Promise<SplitExpense[]> {
  try {
    if (!groupId) return [];
    const q = query(
      collection(db, SPLIT_EXPENSES_COLLECTION),
      where('groupId', '==', groupId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            ...data,
            currency: data.currency || 'USD',
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
            updatedAt: (data.updatedAt as Timestamp).toDate().toISOString(),
        } as SplitExpense
    });
  } catch (error) {
    console.error("[firestore.getSplitExpensesByGroupId] Error getting split expenses by group ID: ", error);
    throw error;
  }
}

async function updateParticipantSettlementStatus(
  splitExpenseId: string,
  participantUserId: string,
  newStatus: SettlementStatus,
  actorProfile?: UserProfile
): Promise<void> {
  const splitExpenseRef = doc(db, SPLIT_EXPENSES_COLLECTION, splitExpenseId);
  await runTransaction(db, async (transaction) => {
    const splitDoc = await transaction.get(splitExpenseRef);
    if (!splitDoc.exists()) throw new Error("Split expense document not found.");
    
    const splitData = splitDoc.data() as SplitExpense;
    const participantIndex = splitData.participants.findIndex(p => p.userId === participantUserId);
    if (participantIndex === -1) throw new Error("Participant not found in this split.");

    const updatedParticipants = [...splitData.participants];
    updatedParticipants[participantIndex].settlementStatus = newStatus;

    transaction.update(splitExpenseRef, { participants: updatedParticipants, updatedAt: Timestamp.now() });

    // --- Notification and Logging Logic ---
    if (!actorProfile) return;

    const fromName = actorProfile.displayName || actorProfile.email || 'A user';
    const amount = formatCurrencyDisplay(updatedParticipants[participantIndex].amountOwed, splitData.currency);
    const link = splitData.groupId ? `/groups/${splitData.groupId}?tab=splits` : '/split';

    let notificationTitle = '';
    let notificationBody = '';
    let toUserId = '';
    let notificationType: Notification['type'] = 'SETTLEMENT_REQUEST';

    if (newStatus === 'pending_approval') {
        toUserId = splitData.paidBy;
        notificationTitle = 'Settlement Approval Required';
        notificationBody = `${fromName} marked a debt of ${amount} for "${splitData.originalExpenseDescription}" as paid. Please approve the settlement.`;
        notificationType = 'SETTLEMENT_REQUEST';
    } else if (newStatus === 'settled') {
        toUserId = participantUserId;
        notificationTitle = 'Settlement Approved';
        notificationBody = `${fromName} approved your settlement of ${amount} for "${splitData.originalExpenseDescription}".`;
        notificationType = 'SETTLEMENT_APPROVED';
    } else if (newStatus === 'unsettled') {
        toUserId = participantUserId;
        notificationTitle = 'Settlement Rejected';
        notificationBody = `${fromName} rejected your settlement of ${amount} for "${splitData.originalExpenseDescription}". Please coordinate with them.`;
        notificationType = 'SETTLEMENT_REJECTED';
    }
    
    if (toUserId && toUserId !== actorProfile.uid) {
        const notificationsCollectionRef = collection(db, NOTIFICATIONS_COLLECTION);
        transaction.set(doc(notificationsCollectionRef), {
            toUserId: toUserId,
            fromUserId: actorProfile.uid,
            fromUserName: fromName,
            type: notificationType,
            title: notificationTitle,
            body: notificationBody,
            link,
            isRead: false,
            createdAt: Timestamp.now(),
        });
    }

    if (splitData.groupId) {
      let actionType: ActivityActionType | null = null;
      let details: string = '';

      if (newStatus === 'pending_approval') {
        actionType = ActivityActionType.SETTLEMENT_REQUESTED;
        details = `${fromName} requested settlement approval for ${amount}.`;
      } else if (newStatus === 'settled') {
        actionType = ActivityActionType.SETTLEMENT_APPROVED;
        details = `${fromName} approved a settlement from ${updatedParticipants[participantIndex].displayName}.`;
      } else if (newStatus === 'unsettled') {
        actionType = ActivityActionType.SETTLEMENT_REJECTED;
        details = `${fromName} rejected a settlement from ${updatedParticipants[participantIndex].displayName}.`;
      }

      if (actionType) {
        // Logging inside a transaction is tricky; this is a simplified approach.
        // For production, this should be an event passed to a Cloud Function.
        const logRef = doc(collection(db, GROUPS_COLLECTION, splitData.groupId, ACTIVITY_LOG_SUBCOLLECTION));
        transaction.set(logRef, {
            actorId: actorProfile.uid,
            actorDisplayName: fromName,
            actionType,
            details,
            timestamp: Timestamp.now(),
        });
      }
    }
  });
}

export async function requestSettlementApproval(splitExpenseId: string, actorProfile: UserProfile): Promise<void> {
  await updateParticipantSettlementStatus(splitExpenseId, actorProfile.uid, 'pending_approval', actorProfile);
}

export async function approveSettlement(splitExpenseId: string, participantUserId: string, actorProfile: UserProfile): Promise<void> {
  await updateParticipantSettlementStatus(splitExpenseId, participantUserId, 'settled', actorProfile);
}

export async function rejectSettlement(splitExpenseId: string, participantUserId: string, actorProfile: UserProfile): Promise<void> {
  await updateParticipantSettlementStatus(splitExpenseId, participantUserId, 'unsettled', actorProfile);
}


export async function deleteSplitExpense(splitExpenseId: string): Promise<void> {
  try {
    const splitExpenseRef = doc(db, SPLIT_EXPENSES_COLLECTION, splitExpenseId);
    await deleteDoc(splitExpenseRef);
  } catch (error) {
    console.error("[firestore.deleteSplitExpense] Error deleting split expense: ", error);
    throw error;
  }
}

export async function updateSplitExpense(
  splitExpenseId: string,
  updates: {
    totalAmount: number;
    payerId: string;
    participants: { userId: string; amountOwed?: number; percentage?: number }[];
    splitMethod: SplitMethod;
    notes?: string;
  },
  actorProfile: UserProfile
): Promise<void> {
  const splitRef = doc(db, SPLIT_EXPENSES_COLLECTION, splitExpenseId);

  return runTransaction(db, async (transaction) => {
    const splitDoc = await transaction.get(splitRef);
    if (!splitDoc.exists()) {
      throw new Error("Split expense document not found for update.");
    }
    const existingSplit = splitDoc.data() as SplitExpense;
    
    const expenseRef = doc(db, EXPENSES_COLLECTION, existingSplit.originalExpenseId);
    const expenseDoc = await transaction.get(expenseRef);
    if (!expenseDoc.exists()) {
        throw new Error("Original expense document not found.");
    }
    const originalExpenseData = expenseDoc.data();
    
    // 1. Update the original expense document
    const updatePayload: any = {
      amount: updates.totalAmount,
      paidById: updates.payerId,
      updatedAt: Timestamp.now(),
    };

    if (originalExpenseData.paidById !== updates.payerId) {
      const payerProfile = await getUserProfile(updates.payerId);
      if (payerProfile) {
          updatePayload.paidByName = payerProfile.displayName || payerProfile.email;
      }
    }
    transaction.update(expenseRef, updatePayload);
    

    // 2. Separate settled participants from the ones to be updated.
    const settledParticipants = existingSplit.participants.filter(p => p.settlementStatus !== 'unsettled');
    const settledAmount = settledParticipants.reduce((sum, p) => sum + p.amountOwed, 0);
    const remainingAmountToSplit = updates.totalAmount - settledAmount;

    if (remainingAmountToSplit < 0 && Math.abs(remainingAmountToSplit) > 0.01) {
      throw new Error("The new total amount is less than the amount already settled by some participants.");
    }
    
    const unsettledParticipantUpdates = updates.participants;
    const finalUnsettledParticipants: SplitParticipant[] = [];
    const existingParticipantsMap = new Map(existingSplit.participants.map(p => [p.userId, p]));

    // Recalculate amounts for UNSETTLED participants
    if (updates.splitMethod === 'equally') {
      const numUnsettled = unsettledParticipantUpdates.length;
      if (numUnsettled > 0) {
        const amountPerPerson = parseFloat((remainingAmountToSplit / numUnsettled).toFixed(2));
        let sum = 0;
        unsettledParticipantUpdates.forEach((p, index) => {
          let amount = amountPerPerson;
          if (index === numUnsettled - 1) { // Adjust last person for rounding
              amount = parseFloat((remainingAmountToSplit - sum).toFixed(2));
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
      const sumOfUnsettled = unsettledParticipantUpdates.reduce((sum, p) => sum + (p.amountOwed || 0), 0);
      if (Math.abs(sumOfUnsettled - remainingAmountToSplit) > 0.01) {
        throw new Error(`The sum of amounts for unsettled members must equal the remaining amount of ${remainingAmountToSplit.toFixed(2)}`);
      }
      unsettledParticipantUpdates.forEach(p => {
        finalUnsettledParticipants.push({
          userId: p.userId,
          displayName: existingParticipantsMap.get(p.userId)?.displayName || 'Unknown',
          email: existingParticipantsMap.get(p.userId)?.email || '',
          amountOwed: p.amountOwed || 0,
          settlementStatus: 'unsettled',
        });
      });
    } else { // byPercentage
      const totalPercentage = unsettledParticipantUpdates.reduce((sum, p) => sum + (p.percentage || 0), 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        throw new Error(`The sum of percentages for unsettled members must equal 100%.`);
      }
      unsettledParticipantUpdates.forEach(p => {
        const amount = parseFloat(((remainingAmountToSplit * (p.percentage || 0)) / 100).toFixed(2));
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
    
    // Ensure the new payer is marked as settled if they are in the final list.
    const newPayerIndex = finalParticipants.findIndex(p => p.userId === updates.payerId);
    if (newPayerIndex !== -1) {
      finalParticipants[newPayerIndex].settlementStatus = 'settled';
    }

    const involvedUserIds = Array.from(new Set(finalParticipants.map(p => p.userId)));
    
    transaction.update(splitRef, {
      totalAmount: updates.totalAmount,
      paidBy: updates.payerId,
      participants: finalParticipants,
      splitMethod: updates.splitMethod,
      notes: updates.notes ?? '',
      involvedUserIds: involvedUserIds,
      updatedAt: Timestamp.now(),
    });

    if (existingSplit.groupId && actorProfile) {
      await logGroupActivity(existingSplit.groupId, {
        actorId: actorProfile.uid,
        actorDisplayName: actorProfile.displayName || actorProfile.email,
        actionType: ActivityActionType.SPLIT_UPDATED,
        details: `updated the split for "${existingSplit.originalExpenseDescription}"`,
        relatedExpenseId: existingSplit.originalExpenseId,
        relatedExpenseName: existingSplit.originalExpenseDescription,
      });
    }
  });
}


// Reminder Functions
export async function addReminder(userId: string, reminderData: ReminderFormData): Promise<string> {
  try {
    if (!userId) throw new Error("User ID is required to add a reminder.");
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, REMINDERS_COLLECTION), {
      userId,
      title: reminderData.title,
      notes: reminderData.notes || '',
      dueDate: Timestamp.fromDate(parseISO(reminderData.dueDate)),
      recurrence: reminderData.recurrence,
      isCompleted: false,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  } catch (error) {
    console.error("[firestore.addReminder] Error adding reminder: ", error);
    throw error;
  }
}

export async function getRemindersByUser(userId: string): Promise<Reminder[]> {
  try {
    if (!userId) return [];
    const q = query(
      collection(db, REMINDERS_COLLECTION),
      where('userId', '==', userId),
      orderBy('dueDate', 'asc')
    );
    const querySnapshot = await getDocs(q);
    const reminders: Reminder[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      reminders.push({
        id: doc.id,
        userId: data.userId,
        title: data.title,
        notes: data.notes,
        dueDate: (data.dueDate as Timestamp).toDate().toISOString().split('T')[0],
        recurrence: data.recurrence as RecurrenceType,
        isCompleted: data.isCompleted,
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        updatedAt: (data.updatedAt as Timestamp).toDate().toISOString(),
      });
    });
    return reminders;
  } catch (error) {
    console.error("[firestore.getRemindersByUser] Error getting reminders: ", error);
    throw error;
  }
}

export async function updateReminder(reminderId: string, data: ReminderFormData): Promise<void> {
  try {
    const reminderRef = doc(db, REMINDERS_COLLECTION, reminderId);
    await updateDoc(reminderRef, {
      title: data.title,
      notes: data.notes || '',
      dueDate: Timestamp.fromDate(parseISO(data.dueDate)),
      recurrence: data.recurrence,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("[firestore.updateReminder] Error updating reminder: ", error);
    throw error;
  }
}

export async function updateReminderCompletion(reminderId: string, isCompleted: boolean): Promise<void> {
  try {
    const reminderRef = doc(db, REMINDERS_COLLECTION, reminderId);
    await updateDoc(reminderRef, {
      isCompleted: isCompleted,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("[firestore.updateReminderCompletion] Error updating reminder completion status: ", error);
    throw error;
  }
}

export async function deleteReminder(reminderId: string): Promise<void> {
  try {
    const reminderRef = doc(db, REMINDERS_COLLECTION, reminderId);
    await deleteDoc(reminderRef);
  } catch (error) {
    console.error("[firestore.deleteReminder] Error deleting reminder: ", error);
    throw error;
  }
}

// Budget Functions
export async function addBudget(userId: string, budgetData: BudgetFormData): Promise<string> {
  try {
    if (!userId) throw new Error("User ID is required to add a budget.");
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (budgetData.period) {
      case "weekly":
        startDate = startOfWeek(now, { weekStartsOn: 1 }); // Assuming Monday start of week
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case "monthly":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "yearly":
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      case "custom":
        if (!budgetData.startDate || !budgetData.endDate) throw new Error("Start and end date are required for custom budgets.");
        startDate = parseISO(budgetData.startDate);
        endDate = parseISO(budgetData.endDate);
        break;
      default:
        throw new Error("Unsupported budget period.");
    }

    const newBudget = {
      userId,
      name: budgetData.name,
      category: budgetData.category,
      amount: parseFloat(budgetData.amount),
      currency: budgetData.currency || 'USD',
      period: budgetData.period,
      startDate: formatISO(startDate, { representation: 'date' }),
      endDate: formatISO(endDate, { representation: 'date' }),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, BUDGETS_COLLECTION), newBudget);
    
    // Achievement check
    const userBudgets = await getBudgetsByUser(userId);
    if(userBudgets.length >= 1) await awardAchievement(userId, 'FIRST_BUDGET');
    if(userBudgets.length >= 5) await awardAchievement(userId, 'BUDGET_5');
    
    return docRef.id;
  } catch (error) {
    console.error("[firestore.addBudget] Error adding budget: ", error);
    throw error;
  }
}

function mapBudgetDocumentToBudgetObject(docSnap: any): Budget | null {
    const docId = docSnap.id;
    try {
        const data = docSnap.data();
        if (!data) {
            console.error(`[firestore.mapBudget] Budget document ${docId} has no data.`);
            return null;
        }

        let createdAtISO: string;
        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
            createdAtISO = (data.createdAt as Timestamp).toDate().toISOString();
        } else {
            console.warn(`[firestore.mapBudget] Budget document ${docId} has invalid or missing 'createdAt' field. Using current date as fallback. Data:`, data.createdAt);
            createdAtISO = new Date().toISOString();
        }

        let updatedAtISO: string;
        if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
            updatedAtISO = (data.updatedAt as Timestamp).toDate().toISOString();
        } else if (data.createdAt && typeof data.createdAt.toDate === 'function') { // Fallback to createdAt if updatedAt is invalid
            console.warn(`[firestore.mapBudget] Budget document ${docId} has invalid or missing 'updatedAt' field. Using 'createdAt' as fallback. Data:`, data.updatedAt);
            updatedAtISO = createdAtISO;
        } else {
            console.warn(`[firestore.mapBudget] Budget document ${docId} has invalid or missing 'updatedAt' and 'createdAt' fields. Using current date as fallback for updatedAt.`);
            updatedAtISO = new Date().toISOString();
        }

        let startDateValid = data.startDate;
        try {
            if (data.startDate) {
                parseISO(data.startDate); // Check if parseable, will throw if not
            } else {
                console.warn(`[firestore.mapBudget] Budget document ${docId} missing 'startDate'. Falling back to start of current month.`);
                startDateValid = formatISO(startOfMonth(new Date()), { representation: 'date' });
            }
        } catch (e) {
            console.warn(`[firestore.mapBudget] Budget document ${docId} has invalid 'startDate' field: ${data.startDate}. Falling back to start of current month.`);
            startDateValid = formatISO(startOfMonth(new Date()), { representation: 'date' });
        }

        let endDateValid = data.endDate;
        try {
            if (data.endDate) {
                parseISO(data.endDate); // Check if parseable
            } else {
                console.warn(`[firestore.mapBudget] Budget document ${docId} missing 'endDate'. Falling back to end of current month.`);
                endDateValid = formatISO(endOfMonth(new Date()), { representation: 'date' });
            }
        } catch (e) {
            console.warn(`[firestore.mapBudget] Budget document ${docId} has invalid 'endDate' field: ${data.endDate}. Falling back to end of current month.`);
            endDateValid = formatISO(endOfMonth(new Date()), { representation: 'date' });
        }

        return {
            id: docId,
            userId: data.userId || 'Unknown User',
            name: data.name || 'Untitled Budget',
            category: data.category || 'Other',
            amount: typeof data.amount === 'number' ? data.amount : 0,
            currency: data.currency || 'USD',
            period: data.period || 'monthly',
            startDate: startDateValid,
            endDate: endDateValid,
            createdAt: createdAtISO,
            updatedAt: updatedAtISO,
            imageUrl: data.imageUrl || undefined,
        };
    } catch (error) {
        console.error(`[firestore.mapBudget] Error mapping budget document ${docId}:`, error, docSnap.data());
        return null;
    }
}

export async function getBudgetsByUser(userId: string): Promise<Budget[]> {
  try {
    if (!userId) return [];
    const q = query(
      collection(db, BUDGETS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
        .map(mapBudgetDocumentToBudgetObject)
        .filter(budget => budget !== null) as Budget[];
  } catch (error) {
    console.error("[firestore.getBudgetsByUser] Error getting budgets by user: ", error);
    throw error;
  }
}

export async function updateBudget(budgetId: string, budgetData: Partial<BudgetFormData>): Promise<void> {
  try {
    const budgetRef = doc(db, BUDGETS_COLLECTION, budgetId);
    const updatePayload: { [key: string]: any } = { updatedAt: Timestamp.now() };

    if (budgetData.name !== undefined) updatePayload.name = budgetData.name;
    if (budgetData.category !== undefined) updatePayload.category = budgetData.category;
    if (budgetData.amount !== undefined) updatePayload.amount = parseFloat(budgetData.amount);
    if (budgetData.currency !== undefined) updatePayload.currency = budgetData.currency;

    if (budgetData.period !== undefined) {
        updatePayload.period = budgetData.period;
        const now = new Date();
        let startDate: Date;
        let endDate: Date;
        switch (budgetData.period) {
            case "weekly":
                startDate = startOfWeek(now, { weekStartsOn: 1 });
                endDate = endOfWeek(now, { weekStartsOn: 1 });
                break;
            case "monthly":
                startDate = startOfMonth(now);
                endDate = endOfMonth(now);
                break;
            case "yearly":
                startDate = startOfYear(now);
                endDate = endOfYear(now);
                break;
            case "custom":
                if (!budgetData.startDate || !budgetData.endDate) throw new Error("Start and end date are required for custom budgets.");
                startDate = parseISO(budgetData.startDate);
                endDate = parseISO(budgetData.endDate);
                break;
            default:
                throw new Error("Unsupported budget period during update.");
        }
        updatePayload.startDate = formatISO(startDate, { representation: 'date' });
        updatePayload.endDate = formatISO(endDate, { representation: 'date' });
    }

    if (Object.keys(updatePayload).length > 1) {
        await updateDoc(budgetRef, updatePayload);
    }
  } catch (error) {
    console.error("[firestore.updateBudget] Error updating budget: ", error);
    throw error;
  }
}

export async function updateBudgetImageUrl(budgetId: string, imageUrl: string): Promise<void> {
  try {
    const budgetRef = doc(db, BUDGETS_COLLECTION, budgetId);
    await updateDoc(budgetRef, {
      imageUrl: imageUrl,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("[firestore.updateBudgetImageUrl] Error updating budget image URL: ", error);
    throw error;
  }
}

export async function deleteBudget(budgetId: string): Promise<void> {
  try {
    const budgetRef = doc(db, BUDGETS_COLLECTION, budgetId);
    await deleteDoc(budgetRef);
  } catch (error) {
    console.error("[firestore.deleteBudget] Error deleting budget: ", error);
    throw error;
  }
}

// Savings Goals Functions
export async function addSavingsGoal(userId: string, goalData: SavingsGoalFormData): Promise<string> {
    try {
        if (!userId) throw new Error("User ID is required to add a savings goal.");
        const newGoal = {
            userId,
            name: goalData.name,
            targetAmount: parseFloat(goalData.targetAmount),
            currentAmount: 0,
            currency: goalData.currency,
            targetDate: goalData.targetDate || null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };
        const docRef = await addDoc(collection(db, SAVINGS_GOALS_COLLECTION), newGoal);
        await awardAchievement(userId, 'FIRST_GOAL');
        return docRef.id;
    } catch (error) {
        console.error("[firestore.addSavingsGoal] Error adding savings goal: ", error);
        throw error;
    }
}

export async function getSavingsGoalsByUser(userId: string): Promise<SavingsGoal[]> {
    try {
        if (!userId) return [];
        const q = query(
            collection(db, SAVINGS_GOALS_COLLECTION),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                targetDate: data.targetDate || undefined,
                createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
                updatedAt: (data.updatedAt as Timestamp).toDate().toISOString(),
                imageUrl: data.imageUrl || undefined,
            } as SavingsGoal;
        });
    } catch (error) {
        console.error("[firestore.getSavingsGoalsByUser] Error getting savings goals: ", error);
        throw error;
    }
}

export async function updateSavingsGoal(goalId: string, goalData: Partial<SavingsGoalFormData>): Promise<void> {
  try {
    const goalRef = doc(db, SAVINGS_GOALS_COLLECTION, goalId);
    const updatePayload: { [key: string]: any } = { updatedAt: Timestamp.now() };

    if (goalData.name !== undefined) updatePayload.name = goalData.name;
    if (goalData.targetAmount !== undefined) updatePayload.targetAmount = parseFloat(goalData.targetAmount);
    if (goalData.targetDate !== undefined) updatePayload.targetDate = goalData.targetDate || null;
    
    if (Object.keys(updatePayload).length > 1) {
      await updateDoc(goalRef, updatePayload);
    }
  } catch (error) {
    console.error("[firestore.updateSavingsGoal] Error updating savings goal: ", error);
    throw error;
  }
}

export async function updateSavingsGoalImageUrl(goalId: string, imageUrl: string): Promise<void> {
  try {
    const goalRef = doc(db, SAVINGS_GOALS_COLLECTION, goalId);
    await updateDoc(goalRef, {
      imageUrl: imageUrl,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("[firestore.updateSavingsGoalImageUrl] Error updating savings goal image URL: ", error);
    throw error;
  }
}

export async function deleteSavingsGoal(goalId: string): Promise<void> {
    const batch = writeBatch(db);
    try {
        // Delete the goal itself
        const goalRef = doc(db, SAVINGS_GOALS_COLLECTION, goalId);
        batch.delete(goalRef);

        // Delete all contributions associated with the goal
        const contributionsQuery = query(collection(db, GOAL_CONTRIBUTIONS_COLLECTION), where('goalId', '==', goalId));
        const contributionsSnapshot = await getDocs(contributionsQuery);
        contributionsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
    } catch (error) {
        console.error("[firestore.deleteSavingsGoal] Error deleting savings goal and its contributions: ", error);
        throw error;
    }
}

export async function addContributionToGoal(userId: string, goalId: string, contributionData: ContributionFormData): Promise<void> {
    const goalRef = doc(db, SAVINGS_GOALS_COLLECTION, goalId);
    const contributionCollectionRef = collection(db, GOAL_CONTRIBUTIONS_COLLECTION);
    
    try {
        await runTransaction(db, async (transaction) => {
            const goalDoc = await transaction.get(goalRef);
            if (!goalDoc.exists()) {
                throw new Error("Savings goal not found.");
            }
            if (goalDoc.data().userId !== userId) {
                throw new Error("User does not have permission to modify this goal.");
            }

            const contributionAmount = parseFloat(contributionData.amount);
            if (isNaN(contributionAmount) || contributionAmount <= 0) {
                throw new Error("Contribution amount must be a positive number.");
            }

            const currentAmount = goalDoc.data().currentAmount || 0;
            const newCurrentAmount = currentAmount + contributionAmount;
            const targetAmount = goalDoc.data().targetAmount;

            // Update the goal's current amount
            transaction.update(goalRef, {
                currentAmount: newCurrentAmount,
                updatedAt: Timestamp.now()
            });

            // Create a new contribution record
            const newContribution: Omit<GoalContribution, 'id'> = {
                goalId,
                userId,
                amount: contributionAmount,
                notes: contributionData.notes || '',
                date: Timestamp.now().toDate().toISOString(),
            };
            transaction.set(doc(contributionCollectionRef), newContribution);
            
            // Award achievement if goal is met for the first time
            if (currentAmount < targetAmount && newCurrentAmount >= targetAmount) {
                await awardAchievement(userId, 'GOAL_ACHIEVED');
            }
        });
    } catch (error) {
        console.error("[firestore.addContributionToGoal] Error adding contribution: ", error);
        throw error;
    }
}

// Group Savings Goals Functions
export async function addGroupSavingsGoal(creatorProfile: UserProfile, groupId: string, goalData: GroupSavingsGoalFormData): Promise<string> {
  try {
    const newGoal = {
      groupId,
      name: goalData.name,
      targetAmount: parseFloat(goalData.targetAmount),
      currentAmount: 0,
      currency: goalData.currency,
      targetDate: goalData.targetDate || null,
      createdBy: {
        uid: creatorProfile.uid,
        displayName: creatorProfile.displayName || creatorProfile.email.split('@')[0],
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, GROUP_SAVINGS_GOALS_COLLECTION), newGoal);

    await logGroupActivity(groupId, {
      actorId: creatorProfile.uid,
      actorDisplayName: creatorProfile.displayName || creatorProfile.email,
      actionType: ActivityActionType.GROUP_GOAL_CREATED,
      details: `created a new savings goal: "${goalData.name}"`,
    });
    
    return docRef.id;
  } catch (error) {
    console.error("[firestore.addGroupSavingsGoal] Error adding group savings goal: ", error);
    throw error;
  }
}

export async function getGroupSavingsGoalsByGroupId(groupId: string): Promise<GroupSavingsGoal[]> {
  try {
    const q = query(
      collection(db, GROUP_SAVINGS_GOALS_COLLECTION),
      where('groupId', '==', groupId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        targetDate: data.targetDate || undefined,
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        updatedAt: (data.updatedAt as Timestamp).toDate().toISOString(),
      } as GroupSavingsGoal;
    });
  } catch (error) {
    console.error("[firestore.getGroupSavingsGoalsByGroupId] Error getting group goals: ", error);
    throw error;
  }
}

export async function updateGroupSavingsGoal(goalId: string, actorProfile: UserProfile, goalData: Partial<GroupSavingsGoalFormData>): Promise<void> {
  const goalRef = doc(db, GROUP_SAVINGS_GOALS_COLLECTION, goalId);
  const goalDoc = await getDoc(goalRef);
  if (!goalDoc.exists()) throw new Error("Goal not found.");

  const updatePayload: { [key: string]: any } = { updatedAt: Timestamp.now() };
  if (goalData.name !== undefined) updatePayload.name = goalData.name;
  if (goalData.targetAmount !== undefined) updatePayload.targetAmount = parseFloat(goalData.targetAmount);
  if (goalData.targetDate !== undefined) updatePayload.targetDate = goalData.targetDate || null;

  await updateDoc(goalRef, updatePayload);
  
  await logGroupActivity(goalDoc.data().groupId, {
    actorId: actorProfile.uid,
    actorDisplayName: actorProfile.displayName || actorProfile.email,
    actionType: ActivityActionType.GROUP_GOAL_UPDATED,
    details: `updated the savings goal: "${goalData.name || goalDoc.data().name}"`,
  });
}

export async function deleteGroupSavingsGoal(goalId: string, actorProfile: UserProfile, groupId: string): Promise<void> {
  const batch = writeBatch(db);
  const goalRef = doc(db, GROUP_SAVINGS_GOALS_COLLECTION, goalId);
  const goalDoc = await getDoc(goalRef);
  if (!goalDoc.exists()) throw new Error("Goal not found.");

  batch.delete(goalRef);

  const contributionsQuery = query(collection(goalRef, GROUP_GOAL_CONTRIBUTIONS_SUBCOLLECTION));
  const contributionsSnapshot = await getDocs(contributionsQuery);
  contributionsSnapshot.forEach(doc => batch.delete(doc.ref));

  await batch.commit();
  
  await logGroupActivity(groupId, {
    actorId: actorProfile.uid,
    actorDisplayName: actorProfile.displayName || actorProfile.email,
    actionType: ActivityActionType.GROUP_GOAL_DELETED,
    details: `deleted the savings goal: "${goalDoc.data().name}"`,
  });
}

export async function addContributionToGroupGoal(actorProfile: UserProfile, groupId: string, goalId: string, contributionData: GroupContributionFormData): Promise<void> {
  const goalRef = doc(db, GROUP_SAVINGS_GOALS_COLLECTION, goalId);
  const contributionRef = doc(collection(goalRef, GROUP_GOAL_CONTRIBUTIONS_SUBCOLLECTION));

  await runTransaction(db, async (transaction) => {
    const goalDoc = await transaction.get(goalRef);
    if (!goalDoc.exists()) throw new Error("Savings goal not found.");

    const contributionAmount = parseFloat(contributionData.amount);
    transaction.update(goalRef, {
      currentAmount: increment(contributionAmount),
      updatedAt: Timestamp.now(),
    });

    const newContribution: Omit<GroupGoalContribution, 'id'> = {
      goalId,
      groupId,
      userId: actorProfile.uid,
      userDisplayName: actorProfile.displayName || actorProfile.email.split('@')[0],
      amount: contributionAmount,
      notes: contributionData.notes || '',
      date: new Date().toISOString(),
    };
    transaction.set(contributionRef, newContribution);

    // After transaction logic, log activity
    const goalData = goalDoc.data();
    await logGroupActivity(groupId, {
        actorId: actorProfile.uid,
        actorDisplayName: actorProfile.displayName || actorProfile.email,
        actionType: ActivityActionType.GROUP_GOAL_CONTRIBUTION,
        details: `contributed ${new Intl.NumberFormat('en-US', { style: 'currency', currency: goalData.currency }).format(contributionAmount)} to the goal: "${goalData.name}"`,
    });
  });
}

export async function getContributionsForGroupGoal(goalId: string): Promise<GroupGoalContribution[]> {
  const contributionsRef = collection(db, GROUP_SAVINGS_GOALS_COLLECTION, goalId, GROUP_GOAL_CONTRIBUTIONS_SUBCOLLECTION);
  const q = query(contributionsRef, orderBy('date', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as GroupGoalContribution));
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

export async function settleDebtWithWallet(splitId: string, settlingUserId: string): Promise<void> {
  return runTransaction(db, async (transaction) => {
    // 1. Get all documents that will be read or written to
    const splitRef = doc(db, SPLIT_EXPENSES_COLLECTION, splitId);
    
    const splitDoc = await transaction.get(splitRef);
    if (!splitDoc.exists()) {
      throw new Error("Split expense not found.");
    }
    const splitData = splitDoc.data() as SplitExpense;
    
    const currency = splitData.currency;
    const payerId = splitData.paidBy;
    
    // Ensure we read both user profiles within the transaction
    const settlerRef = doc(db, USERS_COLLECTION, settlingUserId);
    const payerRef = doc(db, USERS_COLLECTION, payerId);
    
    const settlerDoc = await transaction.get(settlerRef);
    const payerDoc = await transaction.get(payerRef);

    if (!settlerDoc.exists()) {
      throw new Error("Your user profile was not found.");
    }
    if (!payerDoc.exists()) {
        throw new Error("The payer's user profile could not be found.");
    }

    // 2. Perform validation checks
    const participant = splitData.participants.find(p => p.userId === settlingUserId);
    if (!participant) {
      throw new Error("You are not a participant in this split.");
    }
    if (participant.settlementStatus !== 'unsettled') {
      throw new Error("This debt is either already settled or pending approval.");
    }
    const amountToSettle = participant.amountOwed;

    const settlerWallet = settlerDoc.data().wallet || {};
    const settlerBalance = settlerWallet[currency] || 0;
    if (settlerBalance < amountToSettle) {
      throw new Error(`Insufficient funds in your ${currency} wallet. You have ${settlerBalance}, but need ${amountToSettle}.`);
    }
    
    // 3. Perform all write operations
    // Decrease settler's wallet
    transaction.update(settlerRef, {
      [`wallet.${currency}`]: increment(-amountToSettle),
      updatedAt: Timestamp.now(),
    });

    // Increase payer's wallet
    transaction.update(payerRef, {
      [`wallet.${currency}`]: increment(amountToSettle),
      updatedAt: Timestamp.now(),
    });

    // Mark participant as settled in the split document
    const updatedParticipants = splitData.participants.map(p => 
      p.userId === settlingUserId ? { ...p, settlementStatus: 'settled' as SettlementStatus } : p
    );
    transaction.update(splitRef, {
      participants: updatedParticipants,
      updatedAt: Timestamp.now(),
    });
  });
}

// Notification Functions
export async function sendDebtReminder(
  fromUserProfile: UserProfile,
  toUserId: string,
  amount: number,
  currency: CurrencyCode,
  type: 'push' | 'email' | 'sms'
): Promise<void> {
  if (!fromUserProfile || !toUserId) {
    throw new Error("Missing required information to send reminder.");
  }

  const toUser = await getUserProfile(toUserId);
  if (!toUser) {
    throw new Error("Could not find the user to remind.");
  }
  
  const formattedAmount = formatCurrencyDisplay(amount, currency);
  const fromName = fromUserProfile.displayName || fromUserProfile.email;
  const toName = toUser.displayName || toUser.email || toUser.phoneNumber;

  if (type === 'push') {
    const notificationsCollectionRef = collection(db, NOTIFICATIONS_COLLECTION);
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
    const mailCollectionRef = collection(db, MAIL_COLLECTION);
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
    const smsCollectionRef = collection(db, MESSAGES_COLLECTION); 
    await addDoc(smsCollectionRef, {
        to: toUser.phoneNumber,
        body: `SplitChey Reminder: Hi ${toName}, this is a reminder about your outstanding debt of ${formattedAmount} with ${fromName}.`,
    });
  }
}

export async function getNotificationsForUser(userId: string): Promise<Notification[]> {
  try {
    if (!userId) return [];
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('toUserId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20) // Limit to the last 20 notifications
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      } as Notification;
    });
  } catch (error) {
    console.error("[firestore.getNotificationsForUser] Error getting notifications:", error);
    throw error;
  }
}

export async function markNotificationsAsRead(notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return;
  const batch = writeBatch(db);
  notificationIds.forEach(id => {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, id);
    batch.update(docRef, { isRead: true });
  });
  await batch.commit();
}


// Admin Functions
export async function getSystemStats(): Promise<{ userCount: number; expenseCount: number; groupCount: number }> {
  try {
    const usersPromise = getDocs(collection(db, USERS_COLLECTION));
    const expensesPromise = getDocs(collection(db, EXPENSES_COLLECTION));
    const groupsPromise = getDocs(collection(db, GROUPS_COLLECTION));

    const [usersSnapshot, expensesSnapshot, groupsSnapshot] = await Promise.all([
      usersPromise,
      expensesPromise,
      groupsPromise,
    ]);

    return {
      userCount: usersSnapshot.size,
      expenseCount: expensesSnapshot.size,
      groupCount: groupsSnapshot.size,
    };
  } catch (error) {
    console.error("[firestore.getSystemStats] Error getting system statistics: ", error);
    throw error;
  }
}

export async function getAllGroups(): Promise<Group[]> {
  try {
    const groupsCollectionRef = collection(db, GROUPS_COLLECTION);
    const q = query(groupsCollectionRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const memberIds = data.memberIds || [];
        return {
            id: docSnap.id,
            name: data.name,
            createdBy: data.createdBy,
            memberIds: memberIds,
            memberDetails: data.memberDetails || [],
            imageUrl: data.imageUrl || undefined,
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
            updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate().toISOString() : undefined,
        } as Group
    });
  } catch (error) {
    console.error("[firestore.getAllGroups] Error getting all groups: ", error);
    throw error;
  }
}

export async function getAllActivityLogs(limitCount: number = 50): Promise<(GroupActivityLogEntry & { groupName?: string, groupId?: string })[]> {
  try {
    const allGroups = await getAllGroups();
    const allLogsPromises = allGroups.map(async (group) => {
      const logRef = collection(db, GROUPS_COLLECTION, group.id, ACTIVITY_LOG_SUBCOLLECTION);
      const q = query(logRef, orderBy('timestamp', 'desc'), limit(limitCount)); // Limit per group to avoid huge reads
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          timestamp: (data.timestamp as Timestamp).toDate().toISOString(),
          groupName: group.name,
          groupId: group.id,
        } as (GroupActivityLogEntry & { groupName: string, groupId: string });
      });
    });

    const logsPerGroup = await Promise.all(allLogsPromises);
    const allLogs = logsPerGroup.flat();
    
    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return allLogs.slice(0, limitCount);
  } catch (error) {
    console.error("[firestore.getAllActivityLogs] Error fetching all activity logs:", error);
    throw error;
  }
}


export async function adminDeleteGroup(groupId: string): Promise<void> {
  const groupRef = doc(db, GROUPS_COLLECTION, groupId);
  const groupDoc = await getDoc(groupRef);

  if (!groupDoc.exists()) {
    throw new Error("Group not found.");
  }

  const batch = writeBatch(db);

  // Un-group associated expenses
  const expensesQuery = query(collection(db, EXPENSES_COLLECTION), where('groupId', '==', groupId));
  const expensesSnapshot = await getDocs(expensesQuery);
  expensesSnapshot.forEach(doc => {
    batch.update(doc.ref, { groupId: null, groupName: null });
  });

  // Note: Associated splits are intentionally not deleted here to preserve debt history for all users.
  // They will simply have a dangling groupId. A more complex cleanup could be a future enhancement.

  // Delete the group document
  batch.delete(groupRef);

  await batch.commit();
}

export async function getNewUserStatsForChart(): Promise<{ date: string; count: number }[]> {
  const endDate = new Date();
  const startDate = subDays(endDate, 29);
  const dateRange = eachDayOfInterval({ start: startOfDay(startDate), end: startOfDay(endDate) });

  const statsMap = new Map<string, number>();
  dateRange.forEach(date => {
    statsMap.set(format(date, 'MMM dd'), 0);
  });

  const usersQuery = query(collection(db, USERS_COLLECTION), where('createdAt', '>=', Timestamp.fromDate(startDate)));
  const querySnapshot = await getDocs(usersQuery);

  querySnapshot.forEach(doc => {
    const user = doc.data();
    const joinDate = (user.createdAt as Timestamp).toDate();
    const formattedDate = format(startOfDay(joinDate), 'MMM dd');
    if (statsMap.has(formattedDate)) {
      statsMap.set(formattedDate, (statsMap.get(formattedDate) || 0) + 1);
    }
  });
  
  return Array.from(statsMap.entries()).map(([date, count]) => ({ date, count }));
}

export async function getExpenseStatsForChart(): Promise<{ date: string; count: number }[]> {
    const endDate = new Date();
    const startDate = subDays(endDate, 29);
    const dateRange = eachDayOfInterval({ start: startOfDay(startDate), end: startOfDay(endDate) });

    const statsMap = new Map<string, number>();
    dateRange.forEach(date => {
        statsMap.set(format(date, 'MMM dd'), 0);
    });

    const expensesQuery = query(collection(db, EXPENSES_COLLECTION), where('createdAt', '>=', Timestamp.fromDate(startDate)));
    const querySnapshot = await getDocs(expensesQuery);

    querySnapshot.forEach(doc => {
        const expense = doc.data();
        const expenseDate = (expense.createdAt as Timestamp).toDate();
        const formattedDate = format(startOfDay(expenseDate), 'MMM dd');
        if (statsMap.has(formattedDate)) {
            statsMap.set(formattedDate, (statsMap.get(formattedDate) || 0) + 1);
        }
    });

    return Array.from(statsMap.entries()).map(([date, count]) => ({ date, count }));
}

export async function getGlobalCategories(): Promise<GlobalCategory[]> {
    const q = query(collection(db, GLOBAL_CATEGORIES_COLLECTION), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            name: data.name,
            icon: data.icon,
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        } as GlobalCategory;
    });
}

export async function addGlobalCategory(data: { name: string; icon: string }): Promise<string> {
    const docRef = await addDoc(collection(db, GLOBAL_CATEGORIES_COLLECTION), {
        ...data,
        createdAt: Timestamp.now()
    });
    return docRef.id;
}

export async function updateGlobalCategory(id: string, data: { name: string; icon: string }): Promise<void> {
    const docRef = doc(db, GLOBAL_CATEGORIES_COLLECTION, id);
    await updateDoc(docRef, data);
}

export async function deleteGlobalCategory(id: string): Promise<void> {
    const docRef = doc(db, GLOBAL_CATEGORIES_COLLECTION, id);
    await deleteDoc(docRef);
}

export async function seedGlobalCategories(): Promise<void> {
    const categoriesCollection = collection(db, GLOBAL_CATEGORIES_COLLECTION);
    
    const defaultCategories = [
        { name: 'Food', icon: 'utensils' },
        { name: 'Groceries', icon: 'shopping-cart' },
        { name: 'Transportation', icon: 'car' },
        { name: 'Utilities', icon: 'zap' },
        { name: 'Rent/Mortgage', icon: 'home' },
        { name: 'Health', icon: 'heart-pulse' },
        { name: 'Entertainment', icon: 'film' },
        { name: 'Shopping', icon: 'shirt' },
        { name: 'Travel', icon: 'plane' },
        { name: 'Education', icon: 'graduation-cap' },
        { name: 'Personal Care', icon: 'spray-can' },
        { name: 'Gifts & Donations', icon: 'gift' },
        { name: 'Subscriptions', icon: 'newspaper' },
        { name: 'Other', icon: 'tag' },
    ];
    
    const batch = writeBatch(db);
    const now = Timestamp.now();
    const existingSnapshot = await getDocs(categoriesCollection);
    const existingCategoryNames = new Set(existingSnapshot.docs.map(d => d.data().name.toLowerCase()));
    
    let addedCount = 0;
    defaultCategories.forEach(category => {
        if (!existingCategoryNames.has(category.name.toLowerCase())) {
            const docRef = doc(categoriesCollection);
            batch.set(docRef, { ...category, createdAt: now });
            addedCount++;
        }
    });

    if (addedCount > 0) {
        await batch.commit();
    }
}


// App Settings Functions
export async function getFeatureFlags(): Promise<FeatureFlags> {
  const docRef = doc(db, APP_SETTINGS_COLLECTION, 'feature_flags');
  const docSnap = await getDoc(docRef);

  const defaultFlags: FeatureFlags = {
    aiBudgetSuggestions: true,
    userRegistration: true,
    groupCreation: true,
    wallet: true,
    referralProgram: {
        isEnabled: false,
        rewardAmount: 100,
    },
    monetization: false,
  };

  if (docSnap.exists()) {
    const data = docSnap.data();
    // Merge fetched data with defaults to ensure all fields, especially nested ones, are present
    return {
      ...defaultFlags,
      ...data,
      referralProgram: {
        ...defaultFlags.referralProgram,
        ...(data.referralProgram || {}),
      },
    };
  }
  
  // Create the document if it doesn't exist
  await setDoc(docRef, defaultFlags);
  return defaultFlags;
}

export async function updateFeatureFlag(flagName: keyof Omit<FeatureFlags, 'referralProgram' | 'monetization'>, value: boolean): Promise<void> {
  const docRef = doc(db, APP_SETTINGS_COLLECTION, 'feature_flags');
  await setDoc(docRef, { [flagName]: value }, { merge: true });
}

export async function updateReferralProgramSettings(settings: FeatureFlags['referralProgram']): Promise<void> {
    const docRef = doc(db, APP_SETTINGS_COLLECTION, 'feature_flags');
    await setDoc(docRef, { referralProgram: settings }, { merge: true });
}

export async function getPrimaryTextModel(): Promise<string> {
  const docRef = doc(db, APP_SETTINGS_COLLECTION, 'ai_config');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists() && docSnap.data().primaryTextModel) {
    return docSnap.data().primaryTextModel;
  }
  const defaultModel = 'googleai/gemini-2.0-flash';
  await setDoc(docRef, { primaryTextModel: defaultModel }, { merge: true });
  return defaultModel;
}

export async function updatePrimaryTextModel(modelName: string): Promise<void> {
  const docRef = doc(db, APP_SETTINGS_COLLECTION, 'ai_config');
  await setDoc(docRef, { primaryTextModel: modelName }, { merge: true });
}

export async function createBroadcast(title: string, message: string): Promise<void> {
  const batch = writeBatch(db);
  const q = query(collection(db, ANNOUNCEMENTS_COLLECTION), where('isActive', '==', true));
  const activeAnnouncements = await getDocs(q);
  
  activeAnnouncements.forEach(doc => {
    batch.update(doc.ref, { isActive: false });
  });

  const newAnnouncementRef = doc(collection(db, ANNOUNCEMENTS_COLLECTION));
  batch.set(newAnnouncementRef, {
    title,
    message,
    isActive: true,
    createdAt: Timestamp.now(),
  });
  
  await batch.commit();
}

export async function getActiveAnnouncement(): Promise<BroadcastAnnouncement | null> {
  const q = query(
    collection(db, ANNOUNCEMENTS_COLLECTION),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc'),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  const docSnap = snapshot.docs[0];
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
  } as BroadcastAnnouncement;
}

// Investment Functions
export async function addInvestment(userId: string, data: InvestmentFormData): Promise<string> {
    const docRef = await addDoc(collection(db, INVESTMENTS_COLLECTION), {
        userId,
        name: data.name,
        symbol: data.symbol || null,
        type: data.type,
        quantity: parseFloat(data.quantity),
        purchasePrice: parseFloat(data.purchasePrice),
        currentPrice: parseFloat(data.currentPrice),
        purchaseDate: Timestamp.fromDate(parseISO(data.purchaseDate)),
        currency: data.currency,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
    return docRef.id;
}

export async function getInvestmentsByUser(userId: string): Promise<Investment[]> {
    const q = query(
        collection(db, INVESTMENTS_COLLECTION),
        where('userId', '==', userId),
        orderBy('purchaseDate', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            ...data,
            purchaseDate: (data.purchaseDate as Timestamp).toDate().toISOString(),
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
            updatedAt: (data.updatedAt as Timestamp).toDate().toISOString(),
        } as Investment;
    });
}

export async function updateInvestment(investmentId: string, data: InvestmentFormData): Promise<void> {
    const docRef = doc(db, INVESTMENTS_COLLECTION, investmentId);
    await updateDoc(docRef, {
        name: data.name,
        symbol: data.symbol || null,
        type: data.type,
        quantity: parseFloat(data.quantity),
        purchasePrice: parseFloat(data.purchasePrice),
        currentPrice: parseFloat(data.currentPrice),
        purchaseDate: Timestamp.fromDate(parseISO(data.purchaseDate)),
        currency: data.currency,
        updatedAt: Timestamp.now(),
    });
}

export async function deleteInvestment(investmentId: string): Promise<void> {
    const docRef = doc(db, INVESTMENTS_COLLECTION, investmentId);
    await deleteDoc(docRef);
}

// Site Content Management Functions
export async function getSiteContent<T>(sectionId: string): Promise<T | null> {
    const docRef = doc(db, SITE_CONTENT_COLLECTION, sectionId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return serializeFirestoreData(docSnap.data()) as T;
    }
    return null;
}

// Helper to recursively find and upload images
async function uploadImagesInData(data: any, pathPrefix: string): Promise<any> {
    if (Array.isArray(data)) {
        return Promise.all(data.map((item, index) => uploadImagesInData(item, `${pathPrefix}-${index}`)));
    }
    if (data !== null && typeof data === 'object') {
        const newData: { [key: string]: any } = {};
        for (const key in data) {
            newData[key] = await uploadImagesInData(data[key], `${pathPrefix}-${key}`);
        }
        return newData;
    }
    if (typeof data === 'string' && data.startsWith('data:image/')) {
        const storageRef = ref(storage, `${pathPrefix}-${Date.now()}`);
        const uploadResult = await uploadString(storageRef, data, 'data_url');
        return getDownloadURL(uploadResult.ref);
    }
    return data;
}

export async function updateSiteContent(sectionId: string, data: any): Promise<void> {
    const docRef = doc(db, SITE_CONTENT_COLLECTION, sectionId);
    
    // Process images before saving
    const processedData = await uploadImagesInData(data, `site-content/${sectionId}`);
    
    await setDoc(docRef, { ...processedData, updatedAt: Timestamp.now() }, { merge: true });
}

export async function seedSiteContent(): Promise<void> {
    const batch = writeBatch(db);
    const now = Timestamp.now();
    
    // Default data objects from your types.ts or similar
    const defaultHero: SiteContentHero = {
        title: "Master Your Money, Together.",
        description: "The smart way to manage personal expenses, split bills with friends, and track group finances. All in one place.",
        listItems: ["Join thousands managing finances smarter."],
        imageUrl1: 'https://placehold.co/300x180.png',
        imageAiHint1: 'credit card',
        imageUrl2: 'https://placehold.co/300x180.png',
        imageAiHint2: 'credit card',
        imageUrl3: 'https://placehold.co/300x600.png',
        imageAiHint3: 'app screenshot',
    };
    
    const defaultFeatures: SiteContentFeatures = {
      mainTitle: "From Daily Coffee to Group Vacations",
      mainDescription: "With SplitChey, you get access to powerful, modern tools designed to simplify your daily transactions and group expenses.",
      mainImageUrl: 'https://placehold.co/500x500.png',
      mainImageAiHint: 'app transaction',
      threeColFeatures: [
          { id: '1', icon: "CircleDollarSign", title: "Seamless Expense Tracking", description: "Log every transaction with categories, tags, and notes. Understand exactly where your money goes every month." },
          { id: '2', icon: "Split", title: "Effortless Bill Splitting", description: "Split bills equally, by amount, or percentage. Settle up with friends using the integrated wallet or track manual payments." },
          { id: '3', icon: "Users", title: "Collaborative Group Finances", description: "Create groups for trips, households, or projects. Add shared expenses and see a clear breakdown of who owes whom." },
      ],
      personalCard: {
          id: 'personal',
          description: "For Your Personal Finances",
          title: "Clarity on your spending",
          buttonText: "Know More",
          imageUrl: "https://placehold.co/400x300.png",
          imageAiHint: "personal finance charts",
      },
      groupCard: {
          id: 'group',
          description: "For Your Group",
          title: "Simplify shared expenses",
          buttonText: "Know More",
          imageUrl: "https://placehold.co/400x300.png",
          imageAiHint: "team collaboration",
      }
    };

    const defaultMobileApp: SiteContentMobileApp = {
        title: "Take SplitChey With You",
        description: "Manage your finances on the go. Our mobile app has all the features of the web experience, optimized for your device.",
        imageUrl: 'https://placehold.co/300x600.png',
        imageAiHint: 'mobile app finance screen',
        googlePlayUrl: '#',
        appStoreUrl: '#',
        appGalleryUrl: '#',
    };
    
    // ... add all other default content objects (testimonials, faq, etc.) here
    
    const sections: { [key: string]: any } = {
        'hero': defaultHero,
        'features': defaultFeatures,
        'mobile-app': defaultMobileApp,
        // ... and so on
    };

    for (const [sectionId, data] of Object.entries(sections)) {
        const docRef = doc(db, SITE_CONTENT_COLLECTION, sectionId);
        batch.set(docRef, { ...data, updatedAt: now });
    }

    await batch.commit();
}


export async function seedBlogPosts(): Promise<void> {
    const batch = writeBatch(db);
    const now = Timestamp.now();

    const blogPostsRef = collection(db, BLOG_POSTS_COLLECTION);
    const blogPostsToSeed: Omit<BlogPost, 'id' | 'publishedAt' | 'updatedAt'>[] = [
        {
            title: "The Ultimate Guide to Splitting Vacation Costs with Friends",
            slug: "the-ultimate-guide-to-splitting-vacation-costs-with-friends",
            summary: "Planning a trip with friends is exciting, but managing money can be tricky. This guide covers everything from pre-trip budget talks to fair ways of splitting costs, ensuring your vacation is memorable for all the right reasons.",
            content: `<h2>Don't Let Money Ruin a Great Trip</h2><p>Vacations are for making memories, not for arguing over who paid for the pizza. A little planning goes a long way. Here’s how to handle shared costs like a pro.</p><h3>Step 1: Talk About Money Before You Go</h3><p>This is the most crucial step. Before booking anything, have an open conversation about budgets. Agree on a general daily spending limit and discuss what kind of trip you want. Are we doing budget-friendly hostels or a luxury villa? Fine dining or street food? Getting on the same page early prevents resentment later.</p><h3>Step 2: Use a Modern Tool</h3><p>Forget confusing spreadsheets or messy group chats. Use an app like <strong>SplitChey</strong> to track everything. Create a group for your trip, and have everyone log their shared expenses as they happen. The app does the math for you, showing a clear, running tally of who owes whom.</p><h3>Step 3: Decide What's Shared vs. Personal</h3><p>Establish clear rules. Typically, accommodation, group transportation (like a rental car), and group meals are shared. Personal expenses like souvenirs, individual snacks, or optional tours are not. When a shared expense occurs, log it immediately in your group.</p><h3>Step 4: Handle Uneven Costs Fairly</h3><p>What if someone doesn't drink, but the group buys a round of cocktails? <strong>SplitChey's</strong> splitting methods are perfect for this. Instead of splitting equally, you can split by specific amounts or assign different percentages. This flexibility ensures everyone only pays for what they consumed.</p><h3>Step 5: Settle Up Seamlessly</h3><p>At the end of the trip, don't wait weeks to settle up. Open the app, check the final balances, and pay each other back. Using digital payment apps or SplitChey's internal wallet makes transfers instant and painless. A prompt settlement keeps friendships strong!</p>`,
            imageUrl: 'https://placehold.co/1200x630.png',
            imageAiHint: 'friends vacation planning',
            isPublished: true,
            authorId: 'admin-seed-user',
            authorName: 'SplitChey Team',
            authorAvatarUrl: '',
        },
        {
            title: "5 Common Budgeting Mistakes and How to Avoid Them",
            slug: "5-common-budgeting-mistakes-and-how-to-avoid-them",
            summary: "Budgeting is the key to financial freedom, but it's easy to fall into common traps. Learn how to identify and fix these five mistakes to make your budget actually work for you.",
            content: `<h2>Why Your Budget Might Be Failing</h2><p>A budget isn't a financial straitjacket; it's a plan to help you achieve your goals. If you've struggled with budgeting in the past, you might be making one of these common mistakes.</p><h3>1. Being Too Restrictive</h3><p><strong>The Mistake:</strong> You create a budget with no room for fun, coffee, or any small joys. This "all-or-nothing" approach is unsustainable and leads to burnout and quitting.</p><p><strong>The Fix:</strong> Use a flexible framework like the <strong>50/30/20 rule</strong> (50% for needs, 30% for wants, 20% for savings). Actively budget for "fun money" so you can enjoy life guilt-free while still meeting your goals.</p><h3>2. Not Tracking Your Spending</h3><p><strong>The Mistake:</strong> You create a perfect budget but have no idea where your money actually goes. A budget without tracking is just a wishlist.</p><p><strong>The Fix:</strong> Diligently track every single expense. Using an app like <strong>SplitChey</strong> makes this effortless. The simple act of logging a purchase makes you more mindful and helps you stick to your plan.</p><h3>3. Forgetting Irregular Expenses</h3><p><strong>The Mistake:</strong> Your monthly budget looks great, but then an annual subscription, car maintenance, or a holiday gift throws everything off course.</p><p><strong>The Fix:</strong> Create "sinking funds." Identify all your yearly or irregular costs, add them up, and divide by 12. Set that amount aside each month in a separate savings goal so the money is there when you need it.</p><h3>4. Having No Emergency Fund</h3><p><strong>The Mistake:</strong> A single unexpected event, like a medical bill or car repair, forces you into debt because you have no cash buffer.</p><p><strong>The Fix:</strong> Prioritize building an emergency fund. Start small by saving $500, then aim for one month's living expenses. Ultimately, a fund covering 3-6 months of expenses provides true financial security.</p><h3>5. Setting It and Forgetting It</h3><p><strong>The Mistake:</strong> You make a budget in January and never look at it again. Your income, expenses, and goals change over time.</p><p><strong>The Fix:</strong> Your budget is a living document. Schedule a 15-minute budget review at the end of every month. Did you overspend? Where can you adjust? A monthly check-in keeps your plan relevant and effective.</p>`,
            imageUrl: 'https://placehold.co/1200x630.png',
            imageAiHint: 'person budgeting finances',
            isPublished: true,
            authorId: 'admin-seed-user',
            authorName: 'SplitChey Team',
            authorAvatarUrl: '',
        },
        {
            title: "How to Manage Shared Household Expenses with Roommates",
            slug: "how-to-manage-shared-household-expenses-with-roommates",
            summary: "Living with roommates is great for your budget, but terrible for your sanity if you don't have a system for shared bills. Here's a step-by-step guide to creating a fair and frictionless financial setup for your home.",
            content: `<h2>The Key to a Happy Home: Financial Harmony</h2><p>Money is one of the biggest sources of conflict between roommates. By setting up a clear, transparent system from day one, you can avoid arguments and keep the peace. Here’s how.</p><h3>1. The Pre-Move-In Money Talk</h3><p>Before signing the lease, sit down and discuss finances. Decide how you'll split the big, fixed costs like rent and Wi-Fi. Who will be responsible for paying the landlord or utility companies? Set clear deadlines for when everyone needs to transfer their share.</p><h3>2. Categorize Your Shared Costs</h3><p>Divide your expenses into logical categories:</p><ul><li><strong>Fixed Costs:</strong> Rent, internet, renter's insurance. These are usually split evenly.</li><li><strong>Variable Utilities:</strong> Electricity, gas, water. Also typically split evenly.</li><li><strong>Shared Goods:</strong> Things everyone uses, like cleaning supplies, paper towels, trash bags, and kitchen staples like salt and oil.</li></ul><h3>3. The Best System: A Group Finance App</h3><p>While a shared bank account can work, it requires a lot of trust and admin. The easiest and most transparent method is to use a group finance app like <strong>SplitChey</strong>.</p><p>Create a "Household" group and invite all roommates. Whenever someone buys a shared item (like groceries or cleaning supplies), they add it as a group expense. The app automatically calculates who owes what, eliminating any confusion or manual tracking.</p><h3>4. Groceries: The Great Debate</h3><p>Decide on a grocery system. Do you share everything, or does everyone buy their own food? A hybrid approach often works best. Each person buys their own personal groceries, but you can take turns buying communal items like milk, bread, and coffee, logging them in the app.</p><h3>5. Settle Up Monthly, No Excuses</h3><p>Don't let debts linger. At the end of each month, review the balances in your SplitChey group. The app provides a simplified summary of who should pay whom to settle all debts. Use digital payment apps or SplitChey's internal wallet to clear balances instantly. A prompt settlement keeps friendships strong!</p>`,
            imageUrl: 'https://placehold.co/1200x630.png',
            imageAiHint: 'roommates managing bills',
            isPublished: true,
            authorId: 'admin-seed-user',
            authorName: 'SplitChey Team',
            authorAvatarUrl: '',
        },
    ];

    const existingSnapshot = await getDocs(query(blogPostsRef, where('slug', 'in', blogPostsToSeed.map(p => p.slug))));
    const existingSlugs = new Set(existingSnapshot.docs.map(d => d.data().slug));

    let addedCount = 0;
    blogPostsToSeed.forEach(post => {
        if (!existingSlugs.has(post.slug)) {
            const docRef = doc(blogPostsRef);
            batch.set(docRef, { 
                ...post, 
                publishedAt: now.toDate().toISOString(),
                updatedAt: now.toDate().toISOString()
            });
            addedCount++;
        }
    });

    if (addedCount > 0) {
        await batch.commit();
    }
}


export async function getBlogPosts(publishedOnly: boolean = true, limitCount?: number): Promise<BlogPost[]> {
    const constraints = [
        orderBy('publishedAt', 'desc'),
    ];
    if (publishedOnly) {
        constraints.unshift(where('isPublished', '==', true));
    }
    if (limitCount) {
        constraints.push(limit(limitCount));
    }
    
    const q = query(collection(db, BLOG_POSTS_COLLECTION), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            ...data,
            publishedAt: (data.publishedAt instanceof Timestamp ? data.publishedAt.toDate() : new Date(data.publishedAt)).toISOString(),
            updatedAt: (data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt)).toISOString(),
        } as BlogPost;
    });
}

export async function getBlogPostById(id: string): Promise<BlogPost | null> {
    const docRef = doc(db, BLOG_POSTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            ...data,
            publishedAt: (data.publishedAt instanceof Timestamp ? data.publishedAt.toDate() : new Date(data.publishedAt)).toISOString(),
            updatedAt: (data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt)).toISOString(),
        } as BlogPost;
    }
    return null;
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
    const q = query(collection(db, BLOG_POSTS_COLLECTION), where('slug', '==', slug), where('isPublished', '==', true), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return null;
    }
    const docSnap = snapshot.docs[0];
    const data = docSnap.data();
    return {
        id: docSnap.id,
        ...data,
        publishedAt: (data.publishedAt instanceof Timestamp ? data.publishedAt.toDate() : new Date(data.publishedAt)).toISOString(),
        updatedAt: (data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt)).toISOString(),
    } as BlogPost;
}


export async function addBlogPost(data: Omit<BlogPost, 'id' | 'publishedAt' | 'updatedAt'>): Promise<string> {
    const now = new Date().toISOString();
    const docRef = await addDoc(collection(db, BLOG_POSTS_COLLECTION), {
        ...data,
        publishedAt: now,
        updatedAt: now
    });
    return docRef.id;
}

export async function updateBlogPost(id: string, data: Partial<Omit<BlogPost, 'id' | 'publishedAt' | 'updatedAt'>>): Promise<void> {
    const docRef = doc(db, BLOG_POSTS_COLLECTION, id);
    await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteBlogPost(id: string): Promise<void> {
    await deleteDoc(doc(db, BLOG_POSTS_COLLECTION, id));
}

// App Settings & Monetization Functions
export async function getMaintenanceModeSettings(): Promise<MaintenanceModeSettings | null> {
    const docRef = doc(db, APP_SETTINGS_COLLECTION, 'maintenance_mode');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        return {
            isEnabled: data.isEnabled || false,
            fromDateTime: data.fromDateTime,
            toDateTime: data.toDateTime,
            message: data.message || "The site is currently down for scheduled maintenance. We'll be back soon!",
        };
    }
    return { isEnabled: false, message: '', fromDateTime: '', toDateTime: '' };
}

export async function updateMaintenanceModeSettings(settings: MaintenanceModeSettings): Promise<void> {
    const docRef = doc(db, APP_SETTINGS_COLLECTION, 'maintenance_mode');
    await setDoc(docRef, settings, { merge: true });
}

export async function getMonetizationSettings(): Promise<MonetizationSettings> {
  const docRef = doc(db, APP_SETTINGS_COLLECTION, 'monetization');
  const docSnap = await getDoc(docRef);

  const defaultSettings: MonetizationSettings = {
    isEnabled: false,
    plans: {
      free: { limits: { budgets: 3, savingsGoals: 3, investments: 5, aiScansPerMonth: 5 } },
      premium: {
        monthly: { amount: 4.99, currency: 'USD' },
        yearly: { amount: 49.99, currency: 'USD' },
      },
    },
  };

  if (docSnap.exists()) {
    const data = docSnap.data();
    // Deep merge to handle nested objects
    return {
      ...defaultSettings,
      ...data,
      plans: {
        free: { limits: { ...defaultSettings.plans.free.limits, ...(data.plans?.free?.limits || {}) } },
        premium: {
          monthly: { ...defaultSettings.plans.premium.monthly, ...(data.plans?.premium?.monthly || {}) },
          yearly: { ...defaultSettings.plans.premium.yearly, ...(data.plans?.premium?.yearly || {}) },
        },
      },
    };
  }

  // Create the document if it doesn't exist
  await setDoc(docRef, defaultSettings);
  return defaultSettings;
}

export async function updateMonetizationSettings(settings: MonetizationSettings): Promise<void> {
    const docRef = doc(db, APP_SETTINGS_COLLECTION, 'monetization');
    await setDoc(docRef, settings, { merge: true });
}

// Chat Functions
export async function addChatMessage(groupId: string, userId: string, userDisplayName: string, userAvatarUrl: string | null, text: string): Promise<void> {
  if (!groupId || !userId || !text.trim()) {
    throw new Error("Missing required fields to send chat message.");
  }
  const chatMessagesRef = collection(db, GROUPS_COLLECTION, groupId, CHAT_MESSAGES_SUBCOLLECTION);
  await addDoc(chatMessagesRef, {
    groupId,
    userId,
    userDisplayName,
    userAvatarUrl,
    text,
    createdAt: Timestamp.now(),
  });
}

export async function adminWipeAllData(): Promise<{ success: boolean, message: string }> {
  try {
    // Initialize functions service just-in-time to ensure auth context is fresh
    const functionsInstance = getFunctions(getApp(), 'us-central1');
    const wipeData = httpsCallable(functionsInstance, 'adminWipeData');
    const result = await wipeData();
    return result.data as { success: boolean, message: string };
  } catch (error: any) {
    console.error("[firestore.adminWipeAllData] Error calling wipe data function: ", error);
    if (error.code && error.message) {
      throw new Error(`Firebase Functions error (${error.code}): ${error.message}`);
    }
    throw new Error(error.message || "An unexpected error occurred.");
  }
}
