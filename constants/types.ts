

import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  label?: string;
  disabled?: boolean;
  external?: boolean;
  separator?: boolean;
  submenu?: NavItem[];
};

export const SUPPORTED_CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
] as const;

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]['code'];

export type RecurrenceType = "none" | "daily" | "weekly" | "monthly" | "yearly";

export interface Expense {
  id?: string; // Firestore document ID
  userId: string; // The user who "owns" this record
  paidById: string; // The user who actually paid for the expense
  paidByName: string; // Denormalized name of the payer for easier display
  description: string;
  amount: number;
  currency: CurrencyCode;
  category: string;
  date: string; // Stored as YYYY-MM-DD string from form, converted to Firestore Timestamp on save
  notes?: string;
  receiptUrl?: string;
  createdAt: string;
  groupId?: string; // ID of the group this expense belongs to
  groupName?: string; // Denormalized name of the group
  isRecurring?: boolean;
  recurrence?: RecurrenceType;
  recurrenceEndDate?: string; // ISO string YYYY-MM-DD
  tags?: string[];
  isSplitShare?: boolean; // Indicates this is a virtual expense representing a share of a split
  lastInstanceCreated?: string; // ISO string, for recurring expenses
}

export type ExpenseFormData = {
  description: string;
  amount: string; // Input as string, converted to number
  currency: CurrencyCode;
  category: string;
  date: string; // YYYY-MM-DD
  notes?: string;
  groupId?: string; // Optional group ID
  groupName?: string; // Optional: passed to firestore, derived from selected group
  receiptUrl?: string;
  receiptFile?: File | null;
  isRecurring?: boolean;
  recurrence?: RecurrenceType;
  recurrenceEndDate?: string; // YYYY-MM-DD
  tags?: string; // Input as comma-separated string, converted to array
};

export interface Income {
  id?: string;
  userId: string;
  source: string;
  amount: number;
  currency: CurrencyCode;
  date: string; // YYYY-MM-DD
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  isRecurring?: boolean;
  recurrence?: RecurrenceType;
  recurrenceEndDate?: string; // ISO string YYYY-MM-DD
  lastInstanceCreated?: string; // ISO string
}

export type IncomeFormData = {
  source: string;
  amount: string; // Input as string, converted to number
  currency: CurrencyCode;
  date: string; // YYYY-MM-DD
  notes?: string;
  isRecurring?: boolean;
  recurrence?: RecurrenceType;
  recurrenceEndDate?: string;
};

export type SubscriptionPlan = 'free' | 'premium';
export type SubscriptionPlanId = 'free' | 'premium_monthly' | 'premium_yearly';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete';

export interface UserSubscription {
  plan: SubscriptionPlan;
  planId: SubscriptionPlanId;
  status: SubscriptionStatus;
  currentPeriodEnd?: string | null; // ISO string for when the subscription renews or expires
  startedAt: string; // ISO string
}

export interface UserProfile {
  uid: string;
  email: string | null;
  phoneNumber?: string | null;
  displayName?: string;
  photoURL?: string;
  defaultCurrency?: CurrencyCode;
  language?: 'en' | 'es';
  wallet: Partial<Record<CurrencyCode, number>>;
  role?: 'admin' | 'user';
  status?: 'active' | 'suspended';
  createdAt: string;
  hasCompletedOnboarding?: boolean;
  fcmTokens?: string[]; // For push notifications
  referralCode?: string;
  rewardPoints?: number;
  currentStreak?: number;
  lastExpenseDate?: string; // YYYY-MM-DD
  subscription?: UserSubscription;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUserEmail: string | null;
  fromUserDisplayName?: string;
  toUserId: string;
  toUserEmail?: string | null;
  toUserPhoneNumber?: string | null;
  status: 'pending';
  createdAt: string;
}

export interface Friend {
  uid: string;
  email: string | null;
  phoneNumber?: string | null;
  displayName?: string;
  addedAt: string;
  wallet?: Partial<Record<CurrencyCode, number>>;
}

export interface GroupMemberDetail {
  uid: string;
  email: string | null; // Changed to allow null
  displayName?: string;
  role: 'creator' | 'admin' | 'member';
  profilePictureUrl?: string | null; // Added profilePictureUrl
}

export interface Group {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  memberIds: string[];
  memberDetails: GroupMemberDetail[];
  imageUrl?: string;
}

export interface GroupInvitation {
  id: string;
  groupId: string;
  groupName: string;
  inviterId: string;
  inviterDisplayName: string;
  inviteeEmail?: string; // Optional for link-based invites
  token?: string; // For link-based invites
  status: 'pending';
  createdAt: string;
}


export type SplitMethod = "equally" | "byAmount" | "byPercentage";
export type SettlementStatus = 'unsettled' | 'pending_approval' | 'settled';

export interface SplitParticipant {
  userId: string;
  displayName?: string;
  email?: string;
  amountOwed: number;
  percentage?: number;
  settlementStatus: SettlementStatus;
}

export interface SplitExpense {
  id?: string;
  originalExpenseId: string;
  originalExpenseDescription: string;
  currency: CurrencyCode;
  splitMethod: SplitMethod;
  totalAmount: number;
  paidBy: string;
  participants: SplitParticipant[];
  involvedUserIds: string[];
  groupId?: string | null;
  groupName?: string | null;
  createdAt: string;
  updatedAt?: string;
  notes?: string;
}

export type CreateSplitExpenseData = {
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

export interface Reminder {
  id?: string;
  userId: string;
  title: string;
  notes?: string;
  dueDate: string;
  recurrence: RecurrenceType;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReminderFormData = {
  title: string;
  notes?: string;
  dueDate: string; // yyyy-mm-dd
  recurrence: RecurrenceType;
};

export interface GroupMemberBalance {
  uid: string;
  displayName: string;
  email: string;
  paidForGroup: Partial<Record<CurrencyCode, number>>;
  owesToOthersInGroup: Partial<Record<CurrencyCode, number>>;
  netBalance: Partial<Record<CurrencyCode, number>>;
}


export enum ActivityActionType {
  GROUP_CREATED = "GROUP_CREATED",
  GROUP_NAME_UPDATED = "GROUP_NAME_UPDATED",
  GROUP_OWNERSHIP_TRANSFERRED = "GROUP_OWNERSHIP_TRANSFERRED",
  MEMBER_ADDED = "MEMBER_ADDED",
  MEMBER_REMOVED = "MEMBER_REMOVED",
  MEMBER_LEFT = "MEMBER_LEFT",
  MEMBER_ROLE_UPDATED = "MEMBER_ROLE_UPDATED",
  GROUP_DELETED = "GROUP_DELETED",
  EXPENSE_ADDED_TO_GROUP = "EXPENSE_ADDED_TO_GROUP",
  EXPENSE_SPLIT_IN_GROUP = "EXPENSE_SPLIT_IN_GROUP",
  SPLIT_UPDATED = "SPLIT_UPDATED",
  SETTLEMENT_UPDATED_IN_GROUP = "SETTLEMENT_UPDATED_IN_GROUP",
  SETTLEMENT_REQUESTED = "SETTLEMENT_REQUESTED",
  SETTLEMENT_APPROVED = "SETTLEMENT_APPROVED",
  SETTLEMENT_REJECTED = "SETTLEMENT_REJECTED",
  GROUP_GOAL_CREATED = "GROUP_GOAL_CREATED",
  GROUP_GOAL_UPDATED = "GROUP_GOAL_UPDATED",
  GROUP_GOAL_DELETED = "GROUP_GOAL_DELETED",
  GROUP_GOAL_CONTRIBUTION = "GROUP_GOAL_CONTRIBUTION",
  GROUP_GOAL_COMPLETED = "GROUP_GOAL_COMPLETED",
  CHAT_MESSAGE_SENT = "CHAT_MESSAGE_SENT",
}

export interface GroupActivityLogEntry {
  id?: string;
  actorId: string;
  actorDisplayName: string;
  actionType: ActivityActionType;
  details: string;
  timestamp: string; // ISO string
  relatedMemberId?: string | null;
  relatedMemberName?: string | null;
  relatedExpenseId?: string;
  relatedExpenseName?: string;
  previousValue?: string;
  newValue?: string;
}

export type BudgetPeriod = "weekly" | "monthly" | "yearly" | "custom";

export interface Budget {
  id?: string;
  userId: string;
  name: string;
  category: string;
  amount: number;
  currency: CurrencyCode;
  period: BudgetPeriod;
  startDate: string; // ISO string YYYY-MM-DD
  endDate: string; // ISO string YYYY-MM-DD
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  imageUrl?: string;
}

export type BudgetFormData = {
  name: string;
  category: string;
  amount: string; // Input as string, converted to number
  currency: CurrencyCode;
  period: BudgetPeriod;
  startDate?: string;
  endDate?: string;
}

export interface SavingsGoal {
  id?: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: CurrencyCode;
  targetDate?: string; // ISO string YYYY-MM-DD
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  imageUrl?: string;
}

export type SavingsGoalFormData = {
  name: string;
  targetAmount: string;
  currency: CurrencyCode;
  targetDate?: string;
};

export interface GoalContribution {
    id?: string;
    goalId: string;
    userId: string;
    amount: number;
    notes?: string;
    date: string; // ISO string
}

export type ContributionFormData = {
    amount: string;
    notes?: string;
};

export interface AIBudgetSuggestion {
  category: string;
  suggestedAmount: number;
  reasoning: string;
}

export interface GroupSavingsGoal {
  id?: string;
  groupId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: CurrencyCode;
  targetDate?: string; // ISO string YYYY-MM-DD
  createdBy: {
    uid: string;
    displayName: string;
  };
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
}

export type GroupSavingsGoalFormData = {
  name: string;
  targetAmount: string;
  currency: CurrencyCode;
  targetDate?: string;
};

export interface GroupGoalContribution {
  id?: string;
  goalId: string;
  groupId: string;
  userId: string;
  userDisplayName: string;
  amount: number;
  notes?: string;
  date: string; // ISO string
}

export type GroupContributionFormData = {
    amount: string;
    notes?: string;
};

export interface GlobalCategory {
  id: string;
  name: string;
  icon: string; // lucide-react icon name
  createdAt: string;
}

export interface FeatureFlags {
  aiBudgetSuggestions: boolean;
  userRegistration: boolean;
  groupCreation: boolean;
  wallet: boolean;
  referralProgram: {
    isEnabled: boolean;
    rewardAmount: number;
  };
  monetization: boolean;
}

export interface BroadcastAnnouncement {
  id?: string;
  title: string;
  message: string;
  isActive: boolean;
  createdAt: string; // ISO string
}

export const INVESTMENT_TYPES = ["stock", "crypto", "real_estate", "other"] as const;
export type InvestmentType = typeof INVESTMENT_TYPES[number];

export interface Investment {
  id?: string;
  userId: string;
  name: string;
  symbol?: string;
  type: InvestmentType;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: string; // ISO string YYYY-MM-DD
  currency: CurrencyCode;
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
}

export type InvestmentFormData = {
  name: string;
  symbol?: string;
  type: InvestmentType;
  quantity: string;
  purchasePrice: string;
  currentPrice: string;
  purchaseDate: string; // YYYY-MM-DD
  currency: CurrencyCode;
};

// Site Content Management Types
export interface SiteContentBranding {
  appName: string;
  logoUrl?: string;
}

export interface SiteContentHero {
  title: string;
  description: string;
  listItems: string[];
  imageUrl1: string;
  imageAiHint1: string;
  imageUrl2: string;
  imageAiHint2: string;
  imageUrl3: string;
  imageAiHint3: string;
}

export interface ThreeColumnFeature {
    id: string;
    icon: string;
    title: string;
    description: string;
}

export interface TwoColumnFeatureCard {
    id: 'personal' | 'group';
    description: string;
    title: string;
    buttonText: string;
    imageUrl: string;
    imageAiHint: string;
}

export interface SiteContentFeatures {
  mainTitle: string;
  mainDescription: string;
  mainImageUrl: string;
  mainImageAiHint: string;
  threeColFeatures: ThreeColumnFeature[];
  personalCard: TwoColumnFeatureCard;
  groupCard: TwoColumnFeatureCard;
}

export interface TestimonialItem {
    id: string;
    name: string;
    role: string;
    quote: string;
    avatarUrl: string;
    aiHint: string;
    rating: number;
}

export interface SiteContentTestimonials {
    title: string;
    description: string;
    testimonials: TestimonialItem[];
}

export interface FAQItem {
    id: string;
    question: string;
    answer: string;
}

export interface SiteContentFAQ {
    title: string;
    description: string;
    faqs: FAQItem[];
}

export interface SiteContentHowItWorksStep {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface SiteContentHowItWorks {
  title: string;
  description: string;
  steps: SiteContentHowItWorksStep[];
}

export interface SiteContentPricingPlan {
  id: 'free' | 'premium';
  title: string;
  description: string;
  price: string;
  priceSubtext: string;
  features: string[];
  isPopular: boolean;
}

export interface SiteContentPricing {
    title: string;
    description: string;
    plans: SiteContentPricingPlan[];
}


export interface SiteContentCTA {
  icon: string;
  title: string;
  description: string;
  buttonText?: string; // Make optional for embedded form
  secondaryText?: string; // Make optional
}

export interface SiteContentFooter {
  copyrightText: string;
}

export interface SiteContentMobileApp {
    title: string;
    description: string;
    imageUrl: string;
    imageAiHint: string;
    googlePlayUrl: string;
    appStoreUrl: string;
    appGalleryUrl: string;
}


export interface SiteContentAboutPage {
    title: string;
    subtitle: string;
    missionTitle: string;
    missionContent: string;
    storyTitle: string;
    storyContent: string;
    teamTitle: string;
    teamContent: string;
}

export interface SiteContentCareersPage {
    title: string;
    subtitle: string;
    whyJoinUsTitle: string;
    whyJoinUsContent: string;
    positionsTitle: string;
    positionsContent: string;
}

export interface SiteContentContactPage {
    title: string;
    subtitle: string;
    generalTitle: string;
    generalContent: string;
    supportTitle: string;
    supportContent: string;
    officeTitle: string;
    officeContent: string;
}

export interface SiteContentInfoPage {
    title: string;
    lastUpdated: string;
    content: string;
}

export interface MaintenanceModeSettings {
  isEnabled: boolean;
  fromDateTime: string; // ISO string
  toDateTime: string;   // ISO string
  message: string;
}

export interface SiteContentFeature {
  id: string;
  icon: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  imageAiHint: string;
  reverse: boolean;
}

export interface BlogPost {
  id?: string;
  title: string;
  slug: string; // URL-friendly version of the title
  summary: string; // For the card view
  content: string; // Full markdown/html content
  imageUrl: string;
  imageAiHint?: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  publishedAt: string; // ISO string
  updatedAt?: string; // ISO string
  isPublished: boolean;
}

export interface Notification {
  id?: string;
  toUserId: string;
  fromUserId: string;
  fromUserName?: string;
  type: 'DEBT_REMINDER' | 'FRIEND_REQUEST' | 'GROUP_INVITE' | 'SETTLEMENT_REQUEST' | 'SETTLEMENT_APPROVED' | 'SETTLEMENT_REJECTED' | 'ACHIEVEMENT_UNLOCKED';
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  createdAt: string; // ISO string
}

export interface Referral {
    id?: string;
    referrerId: string; // UID of the user who referred
    refereeId: string; // UID of the new user who was referred
    refereeEmail: string | null;
    status: 'pending' | 'completed' | 'ineligible'; // e.g., pending verification, completed after action
    createdAt: string; // ISO string
}

export interface PlanLimits {
  budgets: number;
  savingsGoals: number;
  investments: number;
  aiScansPerMonth: number;
}

export interface PlanPrice {
  id?: string; // e.g., Stripe Price ID for monthly
  amount: number;
  currency: CurrencyCode;
}

export interface MonetizationSettings {
  isEnabled: boolean;
  plans: {
    free: { limits: PlanLimits };
    premium: {
      monthly: PlanPrice;
      yearly: PlanPrice;
    };
  };
}

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string; // Changed from LucideIcon to string
    points: number;
}

export interface UserAchievement {
    id: string; // Corresponds to Achievement id
    earnedAt: string; // ISO string
}

export interface ChatMessage {
  id: string;
  groupId: string;
  userId: string;
  userDisplayName: string;
  userAvatarUrl?: string | null;
  text: string;
  createdAt: string; // ISO String
}

export interface SupportQuery {
    id?: string;
    userEmail: string;
    query: string;
    conversationHistory: string;
    status: 'open' | 'closed';
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
    adminResponse?: string;
    respondedBy?: string; // Admin UID
}
