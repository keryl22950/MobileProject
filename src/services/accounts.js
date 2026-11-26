import {
  EmailAuthProvider,
  linkWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from './firebase';

export async function linkAnonymousAccount(email, password) {
  const user = auth.currentUser;
  if (!user?.isAnonymous) throw new Error('Le compte est déjà associé à une méthode de connexion.');
  const address = email.trim();
  if (!address || password.length < 8)
    throw new Error('Saisis ton adresse e-mail et un mot de passe d’au moins 8 caractères.');
  const { user: linked } = await linkWithCredential(user, EmailAuthProvider.credential(address, password));
  return linked;
}

export function sendAccountVerification() {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Associe d’abord une adresse e-mail à ton compte.');
  return sendEmailVerification(user);
}

export function recoverAccount(email, password) {
  if (!email.trim() || !password) throw new Error('Renseigne ton adresse e-mail et ton mot de passe.');
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function requestPasswordReset(email) {
  if (!email.trim()) throw new Error('Renseigne ton adresse e-mail.');
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }
}

export function signOutOfAccount() {
  if (auth.currentUser?.isAnonymous) throw new Error('Associe une adresse e-mail avant de quitter ce compte.');
  return signOut(auth);
}

export function accountErrorMessage(error) {
  switch (error.code) {
    case 'auth/email-already-in-use':
    case 'auth/credential-already-in-use':
      return 'Cette adresse est déjà liée à un autre compte. Utilise une autre adresse pour conserver ce profil.';
    case 'auth/invalid-email':
      return 'Vérifie le format de ton adresse e-mail.';
    case 'auth/weak-password':
      return 'Choisis un mot de passe plus robuste.';
    case 'auth/network-request-failed':
      return 'Vérifie ta connexion puis réessaie.';
    case 'auth/operation-not-allowed':
      return 'La connexion par e-mail est indisponible pour le moment.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Adresse e-mail ou mot de passe incorrect.';
    default:
      return error.code ? 'L’opération a échoué. Réessaie dans un instant.' : error.message;
  }
}
