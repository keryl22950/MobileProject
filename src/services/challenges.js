import {
  collection,
  doc,
  addDoc,
  setDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  increment,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';

export async function createChallenge({
  groupId,
  createdBy,
  presetId,
  label,
  icon,
  unit,
  target,
  durationHours,
}) {
  const deadline = new Date(Date.now() + durationHours * 60 * 60 * 1000);

  const challengeRef = await addDoc(collection(db, 'groups', groupId, 'challenges'), {
    presetId,
    label,
    icon,
    unit,
    target,
    durationHours,
    deadline,
    createdBy,
    createdAt: serverTimestamp(),
  });

  return challengeRef.id;
}

// Tous les challenges d'un groupe (en cours ou passés), les plus récents d'abord.
export function subscribeToChallenges(groupId, callback) {
  const q = query(collection(db, 'groups', groupId, 'challenges'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeToChallenge(groupId, challengeId, callback) {
  return onSnapshot(doc(db, 'groups', groupId, 'challenges', challengeId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });
}

// Classement d'un challenge précis, triés par progression décroissante.
export function subscribeToProgress(groupId, challengeId, callback) {
  const q = query(
    collection(db, 'groups', groupId, 'challenges', challengeId, 'progress'),
    orderBy('value', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function logActivity({ groupId, challengeId, uid, userName, value }) {
  await addDoc(collection(db, 'groups', groupId, 'challenges', challengeId, 'activities'), {
    userId: uid,
    userName,
    value,
    createdAt: serverTimestamp(),
  });

  // setDoc + merge crée le document de progression au premier ajout, ou
  // l'incrémente s'il existe déjà. On stocke le nom directement ici pour
  // afficher le classement sans avoir à recroiser avec la liste des membres.
  await setDoc(
    doc(db, 'groups', groupId, 'challenges', challengeId, 'progress', uid),
    {
      name: userName,
      value: increment(value),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function subscribeToActivities(groupId, challengeId, callback) {
  const q = query(
    collection(db, 'groups', groupId, 'challenges', challengeId, 'activities'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
