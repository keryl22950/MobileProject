import { EmailAuthProvider, linkWithCredential, sendEmailVerification } from 'firebase/auth';
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
    default:
      return error.code ? 'L’opération a échoué. Réessaie dans un instant.' : error.message;
  }
}
