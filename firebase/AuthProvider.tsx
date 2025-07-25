import { onAuthStateChanged } from 'firebase/auth';
import React, { createContext, ReactNode, useCallback, useEffect, useState } from 'react';
import { auth } from './config';
import { getUserProfile } from './firestore';

export const AuthContext = createContext<any>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState(null); // TODO: fetch from Firestore
  const [loading, setLoading] = useState(true);

  const refetchUserProfile = useCallback(async (uid?: string) => {
    if (!uid && !authUser) return;
    const userId = uid || (authUser && authUser.uid);
    if (!userId) return;
    const profile = await getUserProfile(userId);
    setUserProfile(profile);
  }, [authUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: any) => {
      setLoading(true);
      setAuthUser(user);
      if (user) {
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ authUser, userProfile, loading, refetchUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
} 