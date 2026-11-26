import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import {
  connectAuthEmulator,
  initializeAuth,
  getReactNativePersistence,
  signInAnonymously,
  onAuthStateChanged,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { channel } from 'expo-updates';

const productionConfig = {
  apiKey: 'AIzaSyB4smO8Ks72CYPxj6sx_TaiUseGJlc09Yg',
  authDomain: 'mobileproject-c534a.firebaseapp.com',
  databaseURL: 'https://mobileproject-c534a-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'mobileproject-c534a',
  storageBucket: 'mobileproject-c534a.firebasestorage.app',
  messagingSenderId: '631428127584',
  appId: '1:631428127584:web:12890482eb518848d35c05',
  measurementId: 'G-D0DEM680VE',
};

const development = __DEV__ || channel === 'development';
const devProjectId = process.env.EXPO_PUBLIC_FIREBASE_DEV_PROJECT_ID;
const devApiKey = process.env.EXPO_PUBLIC_FIREBASE_DEV_API_KEY;
const devAppId = process.env.EXPO_PUBLIC_FIREBASE_DEV_APP_ID;
const separateProject = devProjectId && devProjectId !== productionConfig.projectId && devApiKey && devAppId;
const useEmulators = development && !separateProject;
const devConfig = useEmulators
  ? { projectId: 'demo-challengeapp', apiKey: 'demo-key' }
  : { projectId: devProjectId, apiKey: devApiKey, appId: devAppId, authDomain: devProjectId + '.firebaseapp.com' };
const app = initializeApp(development ? devConfig : productionConfig);
export const db = getFirestore(app);

// Sur React Native, il faut explicitement dire à Firebase Auth d'utiliser
// AsyncStorage pour se souvenir de la session (sinon il essaie d'utiliser
// le localStorage du navigateur, qui n'existe pas ici, et plante).
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

if (useEmulators) {
  const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || (Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1');
  connectFirestoreEmulator(db, host, 8180);
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
}

// Connecte l'utilisateur anonymement dès le lancement de l'app.
// Ça permet d'avoir un identifiant unique par personne sans système
// de compte/mot de passe compliqué pour ce prototype.
export function ensureSignedIn(callback) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      callback(user);
    } else {
      signInAnonymously(auth).catch((err) => console.error('Erreur de connexion anonyme :', err));
    }
  });
}
