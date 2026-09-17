// ⚠️ À COMPLÉTER : crée un projet gratuit sur https://console.firebase.google.com
// puis récupère ta config dans "Paramètres du projet > Général > Vos applications"
// et colle-la ci-dessous. Active aussi "Firestore Database" et "Authentication"
// (méthode "Anonyme" suffit pour le prototype) dans la console Firebase.

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  initializeAuth,
  getReactNativePersistence,
  signInAnonymously,
  onAuthStateChanged,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyB4smO8Ks72CYPxj6sx_TaiUseGJlc09Yg",
  authDomain: "mobileproject-c534a.firebaseapp.com",
  databaseURL: "https://mobileproject-c534a-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "mobileproject-c534a",
  storageBucket: "mobileproject-c534a.firebasestorage.app",
  messagingSenderId: "631428127584",
  appId: "1:631428127584:web:12890482eb518848d35c05",
  measurementId: "G-D0DEM680VE"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Sur React Native, il faut explicitement dire à Firebase Auth d'utiliser
// AsyncStorage pour se souvenir de la session (sinon il essaie d'utiliser
// le localStorage du navigateur, qui n'existe pas ici, et plante).
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Connecte l'utilisateur anonymement dès le lancement de l'app.
// Ça permet d'avoir un identifiant unique par personne sans système
// de compte/mot de passe compliqué pour ce prototype.
export function ensureSignedIn(callback) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      callback(user);
    } else {
      signInAnonymously(auth).catch((err) =>
        console.error('Erreur de connexion anonyme :', err)
      );
    }
  });
}
