/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInAnonymously 
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError } from '../lib/firebase';
import { UserProfile, OperationType } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithCode: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // 1. Try finding profile by UID
        const profileRef = doc(db, 'users', user.uid);
        const unsubscribeProfile = onSnapshot(profileRef, async (docSnap) => {
          if (docSnap.exists()) {
            setProfile({ id: docSnap.id, ...docSnap.data() } as UserProfile);
            setLoading(false);
          } else if (user.isAnonymous) {
            // 2. If not found and anonymous, search for linkedUid
            const q = query(collection(db, 'users'), where('linkedUid', '==', user.uid));
            const snap = await getDocs(q);
            if (!snap.empty) {
               const linkedDoc = snap.docs[0];
               setProfile({ id: linkedDoc.id, ...linkedDoc.data() } as any);
            } else {
               setProfile(null);
            }
            setLoading(false);
          } else {
            setProfile(null);
            setLoading(false);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          setLoading(false);
        });
        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const signInWithCode = async (code: string) => {
    try {
      // 1. Sign in anonymously first
      const cred = await signInAnonymously(auth);
      const currentUser = cred.user;

      // 2. Find placeholder by code
      const q = query(collection(db, 'users'), where('loginCode', '==', code.toUpperCase()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        throw new Error('Ongeldige code');
      }

      const placeholderDoc = snap.docs[0];
      
      // 3. Link UID to this profile
      await updateDoc(doc(db, 'users', placeholderDoc.id), {
        linkedUid: currentUser.uid,
        updatedAt: serverTimestamp()
      });

      setProfile({ id: placeholderDoc.id, ...placeholderDoc.data(), linkedUid: currentUser.uid } as any);
    } catch (error) {
      console.error('Code login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    localStorage.removeItem('childProfileId');
    await signOut(auth);
  };

  const refreshProfile = async () => {
    if (!user) return;
    const docSnap = await getDoc(doc(db, 'users', user.uid));
    if (docSnap.exists()) {
      setProfile({ id: docSnap.id, ...docSnap.data() } as UserProfile);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, signInWithCode, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
