import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { createPagedFeed } from './pagedFeed';
import { subscriptionErrors } from './subscriptionErrors';

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
  await updateDoc(challengeDoc(groupId, groupementId, challengeId), changes);
}

// Le document disparaît immédiatement. La fonction serveur nettoie ensuite ses descendants.
export async function deleteChallenge({ groupId, groupementId, challengeId }) {
  await deleteDoc(challengeDoc(groupId, groupementId, challengeId));
}

export function subscribeToChallenges(groupId, groupementId, callback, onError) {
  const q = query(challengesCol(groupId, groupementId), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    subscriptionErrors('challenges', onError)
  );
}

export function subscribeToChallenge(groupId, groupementId, challengeId, callback, onError) {
  return onSnapshot(
    challengeDoc(groupId, groupementId, challengeId),
    (snap) => {
      if (snap.exists()) callback({ id: snap.id, ...snap.data() });
    },
    subscriptionErrors('challenge', onError)
  );
}

export function subscribeToProgress(groupId, groupementId, challengeId, periodKey, callback, onError) {
  const q = query(
    challengeSubCollection(groupId, groupementId, challengeId, 'periods', periodKey, 'progress'),
    orderBy('value', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    subscriptionErrors('progression', onError)
  );
}

export function subscribeToCumulative(groupId, groupementId, challengeId, callback, onError) {
  const q = query(challengeSubCollection(groupId, groupementId, challengeId, 'cumulative'), orderBy('value', 'desc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    subscriptionErrors('cumul', onError)
  );
}

// Le fil des activités individuelles d'un challenge, pour une période donnée
// (avec leur date) — affiché dans ChallengeScreen.
export function getChallengeActivityFeed(groupId, groupementId, challengeId, periodKey) {
  return createPagedFeed(
    challengeSubCollection(groupId, groupementId, challengeId, 'periods', periodKey, 'activities'),
    50
  );
}
