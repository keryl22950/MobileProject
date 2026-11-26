import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { createPagedFeed } from './pagedFeed';
import { subscriptionErrors } from './subscriptionErrors';

export async function getUserDisplayName(uid) {
  return (await getDoc(doc(db, 'users', uid))).data()?.displayName ?? null;
}

export async function upsertUserProfile({ uid, displayName }) {
  await setDoc(
    doc(db, 'users', uid),
    {
      displayName,
      nameLower: displayName.toLowerCase(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function removeFriend({ uid, friendUid }) {
  await deleteDoc(doc(db, 'users', uid, 'friends', friendUid));
}

export async function searchUsersByName(prefix) {
  const lower = prefix.trim().toLowerCase();
  if (!lower) return [];
  const q = query(
    collection(db, 'users'),
    where('nameLower', '>=', lower),
    where('nameLower', '<=', lower + '\uf8ff'),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addFriend({ uid, friendUid }) {
  await setDoc(doc(db, 'users', uid, 'friends', friendUid), { addedAt: serverTimestamp() });
}

export function subscribeToFriends(uid, callback, onError) {
  let revision = 0;
  const report = subscriptionErrors('amis', onError);
  const unsubscribe = onSnapshot(
    collection(db, 'users', uid, 'friends'),
    async (snap) => {
      const current = ++revision;
      const friendIds = snap.docs.map((d) => d.id);
      try {
        const profiles = await Promise.all(
          friendIds.map(async (fid) => {
            const userSnap = await getDoc(doc(db, 'users', fid));
            return userSnap.exists() ? { id: fid, ...userSnap.data() } : { id: fid, displayName: '?' };
          })
        );
        if (current === revision) callback(profiles);
      } catch (error) {
        if (current === revision) report(error);
      }
    },
    report
  );
  return () => {
    revision++;
    unsubscribe();
  };
}

export function subscribeToUserStats(uid, callback, onError) {
  return onSnapshot(
    collection(db, 'users', uid, 'stats'),
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    subscriptionErrors('statistiques du profil', onError)
  );
}

export async function getImportedExternalIds(uid) {
  const snap = await getDocs(query(collection(db, 'users', uid, 'activities'), where('imported', '==', true)));
  return new Set(
    snap.docs.flatMap((entry) => {
      const { externalId, externalIds = [] } = entry.data();
      return [externalId || entry.id, ...externalIds];
    })
  );
}

export function getUserActivityFeed(uid) {
  return createPagedFeed(collection(db, 'users', uid, 'activities'), 50);
}
