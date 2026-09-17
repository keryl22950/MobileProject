import { collection, doc, addDoc, setDoc, onSnapshot, orderBy, query, serverTimestamp, increment } from 'firebase/firestore';
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
function challengeSubDoc(groupId, groupementId, challengeId, ...segments) {
  return doc(db, 'groups', groupId, 'groupements', groupementId, 'challenges', challengeId, ...segments);
}

export async function createChallenge({ groupId, groupementId, createdBy, presetId, label, icon, unit, target }) {
  const ref = await addDoc(challengesCol(groupId, groupementId), {
    presetId, label, icon, unit, target, createdBy, createdAt: serverTimestamp(),
  });
  return ref.id;
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

// Classement de la période en cours (ou d'une période passée pour l'historique).
export function subscribeToProgress(groupId, groupementId, challengeId, periodKey, callback) {
  const q = query(
      challengeSubCollection(groupId, groupementId, challengeId, 'periods', periodKey, 'progress'),
      orderBy('value', 'desc')
  );
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

// Total cumulé, toutes périodes confondues (pour l'écran Statistiques).
export function subscribeToCumulative(groupId, groupementId, challengeId, callback) {
  const q = query(
      challengeSubCollection(groupId, groupementId, challengeId, 'cumulative'),
      orderBy('value', 'desc')
  );
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function logActivity({ groupId, groupementId, challengeId, periodKey, uid, userName, value }) {
  await addDoc(challengeSubCollection(groupId, groupementId, challengeId, 'periods', periodKey, 'activities'), {
    userId: uid, userName, value, createdAt: serverTimestamp(),
  });

  await setDoc(
      challengeSubDoc(groupId, groupementId, challengeId, 'periods', periodKey, 'progress', uid),
      { name: userName, value: increment(value), updatedAt: serverTimestamp() },
      { merge: true }
  );

  // Alimente le cumul global en parallèle, sans jamais repartir à zéro.
  await setDoc(
      challengeSubDoc(groupId, groupementId, challengeId, 'cumulative', uid),
      { name: userName, value: increment(value), updatedAt: serverTimestamp() },
      { merge: true }
  );
}