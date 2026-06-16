import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { auth } from '../firebase';
import { loadFromCloud, setCloudUser } from '../database/database';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Handle redirect result (iOS/popup-blocked fallback)
    getRedirectResult(auth).catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setCloudUser(u?.uid ?? null);
      if (u) {
        // Sync with cloud, timeout after 8s to not block startup
        await Promise.race([
          loadFromCloud(u.uid),
          new Promise<void>((resolve) => setTimeout(resolve, 8000)),
        ]);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/cancelled-popup-request') {
        await signInWithRedirect(auth, provider);
      } else {
        throw e;
      }
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setCloudUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
