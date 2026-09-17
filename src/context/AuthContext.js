import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureSignedIn } from '../services/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [uid, setUid] = useState(null);
  const [displayName, setDisplayNameState] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureSignedIn(async (user) => {
      setUid(user.uid);
      const savedName = await AsyncStorage.getItem('displayName');
      if (savedName) setDisplayNameState(savedName);
      setReady(true);
    });
  }, []);

  async function setDisplayName(name) {
    await AsyncStorage.setItem('displayName', name);
    setDisplayNameState(name);
  }

  return (
    <AuthContext.Provider value={{ uid, displayName, ready, setDisplayName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}
