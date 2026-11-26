import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase/app';
import * as authSdk from 'firebase/auth';
import * as firestore from 'firebase/firestore';
import { loadService } from './load-service.mjs';

const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
assert.match(host ?? '', /^127\.0\.0\.1:\d+$/);
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
assert.match(firestoreHost ?? '', /^127\.0\.0\.1:\d+$/);
const apps = [];
after(() => Promise.all(apps.map(deleteApp)));

async function accountClient() {
  const app = initializeApp({ projectId: 'demo-challengeapp', apiKey: 'demo-key' }, 'account-' + apps.length);
  apps.push(app);
  const auth = authSdk.getAuth(app);
  authSdk.connectAuthEmulator(auth, 'http://' + host, { disableWarnings: true });
  const service = await loadService('accounts.js', { 'firebase/auth': authSdk, './firebase': { auth } });
  return { app, auth, service };
}

test('Lier un compte anonyme conserve son UID et permet de demander une vérification', async () => {
  const { auth, service } = await accountClient();
  const { user: guest } = await authSdk.signInAnonymously(auth);
  const uid = guest.uid;
  const linked = await service.linkAnonymousAccount(' test-' + uid + '@example.com ', 'test-password');
  assert.equal(linked.uid, uid);
  assert.equal(linked.isAnonymous, false);
  assert.equal(linked.email, 'test-' + uid.toLowerCase() + '@example.com');
  await service.sendAccountVerification();
  await assert.rejects(service.linkAnonymousAccount('other@example.com', 'test-password'), /déjà associé/);
});

test('La déconnexion et la récupération utilisent le même UID alors qu’une adresse occupée préserve l’invité', async () => {
  const owner = await accountClient();
  const { user } = await authSdk.signInAnonymously(owner.auth);
  const email = 'recover-' + user.uid.toLowerCase() + '@example.com';
  const uid = user.uid;
  await owner.service.linkAnonymousAccount(email, 'test-password');
  const guest = await accountClient();
  const { user: guestUser } = await authSdk.signInAnonymously(guest.auth);
  await assert.rejects(guest.service.linkAnonymousAccount(email, 'different-password'), {
    code: 'auth/email-already-in-use',
  });
  assert.equal(guest.auth.currentUser.uid, guestUser.uid);
  assert.equal(guest.auth.currentUser.isAnonymous, true);
  assert.throws(() => guest.service.signOutOfAccount(), /Associe/);
  await owner.service.signOutOfAccount();
  assert.equal(owner.auth.currentUser, null);
  await guest.service.requestPasswordReset(email);
  const restored = await guest.service.recoverAccount(email, 'test-password');
  assert.equal(restored.user.uid, uid);
});

test('Une installation vierge récupère les groupes, amis, statistiques et imports du compte associé', async () => {
  const first = await accountClient();
  const { user } = await authSdk.signInAnonymously(first.auth);
  const uid = user.uid;
  const email = 'data-' + uid.toLowerCase() + '@example.com';
  const connect = (app) => {
    const db = firestore.getFirestore(app);
    firestore.connectFirestoreEmulator(db, '127.0.0.1', Number(firestoreHost.split(':').at(-1)));
    return db;
  };
  const db = connect(first.app);
  const users = await loadService('users.js', { 'firebase/firestore': firestore, './firebase': { db } });
  await users.upsertUserProfile({ uid, displayName: 'Profil récupéré' });
  await users.addFriend({ uid, friendUid: 'friend-one' });
  await firestore.setDoc(firestore.doc(db, 'users', uid, 'stats', 'running'), { total: 5 });
  await firestore.setDoc(firestore.doc(db, 'users', uid, 'activities', 'hc_old'), {
    imported: true,
    externalId: 'hc_old',
    externalIds: ['hc_alias'],
  });
  await firestore.setDoc(firestore.doc(db, 'groups', 'restored-' + uid), {
    name: 'Groupe récupéré',
    ownerId: uid,
    memberIds: [uid],
  });
  await first.service.linkAnonymousAccount(email, 'test-password');

  const fresh = await accountClient();
  assert.equal(fresh.auth.currentUser, null);
  const restored = await fresh.service.recoverAccount(email, 'test-password');
  assert.equal(restored.user.uid, uid);
  const restoredDb = connect(fresh.app);
  const restoredUsers = await loadService('users.js', {
    'firebase/firestore': firestore,
    './firebase': { db: restoredDb },
  });
  assert.equal(await restoredUsers.getUserDisplayName(uid), 'Profil récupéré');
  assert.deepEqual(await restoredUsers.getImportedExternalIds(uid), new Set(['hc_old', 'hc_alias']));
  assert.ok((await firestore.getDoc(firestore.doc(restoredDb, 'users', uid, 'friends', 'friend-one'))).exists());
  assert.equal((await firestore.getDoc(firestore.doc(restoredDb, 'users', uid, 'stats', 'running'))).data().total, 5);
  const groups = firestore.query(
    firestore.collection(restoredDb, 'groups'),
    firestore.where('memberIds', 'array-contains', uid)
  );
  assert.equal((await firestore.getDocs(groups)).docs[0].data().name, 'Groupe récupéré');
});
