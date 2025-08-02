import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import React, { createContext, ReactNode, useCallback, useEffect, useState } from 'react';
import { auth, db } from './config';
import { getUserProfile } from './firestore';

export const AuthContext = createContext<{
  authUser: any;
  userProfile: any;
  loading: boolean;
  refetchUserProfile: (uid?: string) => Promise<void>;
} | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);



  const refetchUserProfile = useCallback(async (uid?: string) => {
    if (!uid && !authUser) return;
    const userId = uid || (authUser && authUser.uid);
    if (!userId) return;
    try {
      const profile = await getUserProfile(userId);
      setUserProfile(profile);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  }, [authUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: any) => {
      setLoading(true);
      setAuthUser(user);
      if (user) {
        // Ensure user profile exists in Firestore upon login/signup
        // This handles cases where a user might sign up via social auth
        // or if their profile wasn't created immediately for some reason.
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          // Create a basic profile if it doesn't exist
          await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email || null,
            phoneNumber: user.phoneNumber || null,
            displayName: user.displayName || (user.email ? user.email.split('@')[0] : user.phoneNumber) || 'User',
            photoURL: user.photoURL || null,
            defaultCurrency: 'USD', // Default currency
            language: 'en',
            wallet: {},
            role: 'user',
            status: 'active',
            createdAt: Timestamp.now(),
            hasCompletedOnboarding: false,
            referralCode: null,
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
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const contextValue = { authUser, userProfile, loading, refetchUserProfile };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
} 