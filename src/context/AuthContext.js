import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, ensureSignedIn } from '../services/firebase';
import { getUserDisplayName, upsertUserProfile } from '../services/users';

const AuthContext = createContext(null);
const profileKey = (uid) => 'displayName:' + auth.app.options.projectId + ':' + uid;

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ uid: null, displayName: null, ready: false });
  const [attempt, setAttempt] = useState(0);
  const { uid, displayName, ready } = session;

  useEffect(() => {
    let revision = 0;
    let disposed = false;
    const unsubscribe = ensureSignedIn(
      async (user) => {
        const current = ++revision;
        const key = profileKey(user.uid);
        setSession({ uid: user.uid, displayName: null, ready: false });
        let name;
        try {
          name = await AsyncStorage.getItem(key);
          if (!name) {
            // Lire le pseudo du compte récupéré. Le cache historique ne
            // s’applique qu’au compte anonyme restauré au premier démarrage.
            name = await getUserDisplayName(user.uid);
            const legacy = current === 1 && user.isAnonymous && auth.app.options.projectId === 'mobileproject-c534a';
            if (!name && legacy) name = await AsyncStorage.getItem('displayName');
            if (name) await AsyncStorage.setItem(key, name);
          }
          if (current === 1 && auth.app.options.projectId === 'mobileproject-c534a') {
            await AsyncStorage.removeItem('displayName');
          }
        } catch {
          if (current === revision) setSession({ uid: user.uid, displayName: null, ready: true, profileError: true });
          return;
        }
        if (current === revision) setSession({ uid: user.uid, displayName: name ?? null, ready: true });
      },
      () => {
        if (!disposed) setSession({ uid: null, displayName: null, ready: true, profileError: true });
      }
    );
    return () => {
      disposed = true;
      revision++;
      unsubscribe();
    };
  }, [attempt]);

  async function setDisplayName(name) {
    if (!uid) return;
    await upsertUserProfile({ uid, displayName: name });
    await AsyncStorage.setItem(profileKey(uid), name);
    setSession((previous) => (previous.uid === uid ? { ...previous, displayName: name } : previous));
  }

  return (
    <AuthContext.Provider
      value={{
        uid,
        displayName,
        ready,
        setDisplayName,
        profileError: session.profileError,
        retryProfile: () => {
          setSession({ uid: null, displayName: null, ready: false });
          setAttempt((previous) => previous + 1);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}
