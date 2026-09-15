// ⚠️ À COMPLÉTER : crée un projet gratuit sur https://console.firebase.google.com
// puis récupère ta config dans "Paramètres du projet > Général > Vos applications"
// et colle-la ci-dessous. Active aussi "Firestore Database" et "Authentication"
// (méthode "Anonyme" suffit pour le prototype) dans la console Firebase.

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'REMPLACE_MOI',
  authDomain: 'REMPLACE_MOI.firebaseapp.com',
  projectId: 'REMPLACE_MOI',
  storageBucket: 'REMPLACE_MOI.appspot.com',
  messagingSenderId: 'REMPLACE_MOI',
  appId: 'REMPLACE_MOI',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

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
