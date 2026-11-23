import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import {
  arrayRemove, arrayUnion, collection, connectFirestoreEmulator, deleteDoc, doc, getDocs,
  getFirestore, serverTimestamp, setDoc, updateDoc, where, query, writeBatch,
} from 'firebase/firestore';

const projectId = 'demo-challengeapp';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
assert(authHost && firestoreHost, 'Run with the Auth and Firestore emulators');
const firestore = new URL('http://' + firestoreHost);
const apps = [];

async function client(name) {
  const app = initializeApp({ projectId, apiKey: 'demo-key' }, name);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://' + authHost, { disableWarnings: true });
  const { user } = await signInAnonymously(auth);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, firestore.hostname, Number(firestore.port));
  return { db, uid: user.uid };
}

const denied = (promise) => assert.rejects(promise, { code: 'permission-denied' });
const group = ({ db }) => doc(db, 'groups', 'test-group');
const member = (client, uid = client.uid) => doc(group(client), 'members', uid);
const profile = (role) => ({ name: 'Test', role, joinedAt: serverTimestamp() });

try {
  const [owner, participant, outsider] = await Promise.all(
    ['owner', 'participant', 'outsider'].map(client)
  );
  const create = writeBatch(owner.db);
  create.set(group(owner), { name: 'Test', inviteCode: 'ABCDEF', ownerId: owner.uid, memberIds: [owner.uid] });
  create.set(member(owner), profile('creator'));
  await create.commit();

  const invitations = query(collection(outsider.db, 'groups'), where('inviteCode', '==', 'ABCDEF'));
  assert.equal((await getDocs(invitations)).size, 1);
  await denied(setDoc(member(outsider), profile('participant')));
  await denied(getDocs(collection(group(outsider), 'members')));
  const score = (client, uid = client.uid) => doc(group(client), 'groupements', 'event', 'challenges', 'challenge', 'cumulative', uid);
  await denied(setDoc(score(outsider), { value: 1 }));

  const join = writeBatch(participant.db);
  join.update(group(participant), { memberIds: arrayUnion(participant.uid) });
  join.set(member(participant), profile('participant'));
  await join.commit();
  await setDoc(score(participant), { value: 1 });
  await denied(setDoc(score(participant, owner.uid), { value: 1 }));
  await denied(updateDoc(group(participant), { name: 'Rename' }));
  await denied(updateDoc(group(participant), { memberIds: arrayUnion(outsider.uid) }));
  await denied(updateDoc(member(participant), { role: 'admin' }));
  await updateDoc(member(owner, participant.uid), { role: 'admin' });
  await updateDoc(group(participant), { name: 'Rename' });
  await denied(updateDoc(member(participant, owner.uid), { role: 'participant' }));

  const leave = writeBatch(owner.db);
  leave.update(member(owner, participant.uid), { role: 'creator' });
  leave.update(group(owner), { memberIds: arrayRemove(owner.uid), ownerId: participant.uid });
  leave.delete(member(owner));
  await leave.commit();
  await denied(setDoc(score(owner), { value: 2 }));

  const close = writeBatch(participant.db);
  close.delete(member(participant));
  close.delete(group(participant));
  await close.commit();

  // Les APK existants utilisent encore des écritures séparées.
  await setDoc(group(owner), { name: 'Legacy', inviteCode: 'ABCDEF', ownerId: owner.uid, memberIds: [owner.uid] });
  await setDoc(member(owner), profile('creator'));
  await updateDoc(group(outsider), { memberIds: arrayUnion(outsider.uid) });
  await setDoc(member(outsider), profile('participant'));
  await updateDoc(group(outsider), { memberIds: arrayRemove(outsider.uid) });
  await deleteDoc(member(outsider));
  await updateDoc(group(participant), { memberIds: arrayUnion(participant.uid) });
  await setDoc(member(participant), profile('participant'));
  await updateDoc(member(owner, participant.uid), { role: 'creator' });
  await updateDoc(group(owner), { memberIds: arrayRemove(owner.uid), ownerId: participant.uid });
  await deleteDoc(member(owner));
  console.log('Firestore rules checks passed');
} finally {
  await Promise.all(apps.map(deleteApp));
}
