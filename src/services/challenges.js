import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';

function challengesCol(groupId, groupementId) {
  return collection(db, 'groups', groupId, 'groupements', groupementId, 'challenges');
}
function challengeDoc(groupId, groupementId, challengeId) {
  return doc(db, 'groups', groupId, 'groupements', groupementId, 'challenges', challengeId);
}
function challengeSubCollection(groupId, groupementId, challengeId, ...segments) {
  return collection(db, 'groups', groupId, 'groupements', groupementId, 'challenges', challengeId, ...segments);
}

export async function createChallenge({ groupId, groupementId, createdBy, presetId, label, icon, unit, target }) {
  const ref = await addDoc(challengesCol(groupId, groupementId), {
    presetId,
    label,
    icon,
    unit,
    target,
    createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateChallenge({ groupId, groupementId, challengeId, changes }) {
  await setDoc(challengeDoc(groupId, groupementId, challengeId), changes, { merge: true });
}

// Suppression "superficielle" : le document challenge disparaît (donc invisible
// dans l'app), mais ses sous-collections (periods, cumulative) restent dans
// Firestore, orphelines. Une suppression en cascade fiable demanderait une
// Cloud Function — pas grave à ce stade de test, à revoir si ça compte un jour.
export async function deleteChallenge({ groupId, groupementId, challengeId }) {
  await deleteDoc(challengeDoc(groupId, groupementId, challengeId));
}

export function subscribeToChallenges(groupId, groupementId, callback) {
  const q = query(challengesCol(groupId, groupementId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export function subscribeToChallenge(groupId, groupementId, challengeId, callback) {
  return onSnapshot(challengeDoc(groupId, groupementId, challengeId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });
}

export function subscribeToProgress(groupId, groupementId, challengeId, periodKey, callback) {
  const q = query(
    challengeSubCollection(groupId, groupementId, challengeId, 'periods', periodKey, 'progress'),
    orderBy('value', 'desc')
  );
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export function subscribeToCumulative(groupId, groupementId, challengeId, callback) {
  const q = query(challengeSubCollection(groupId, groupementId, challengeId, 'cumulative'), orderBy('value', 'desc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

// Le fil des activités individuelles d'un challenge, pour une période donnée
// (avec leur date) — affiché dans ChallengeScreen.
export function subscribeToActivities(groupId, groupementId, challengeId, periodKey, callback) {
  const q = query(
    challengeSubCollection(groupId, groupementId, challengeId, 'periods', periodKey, 'activities'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
