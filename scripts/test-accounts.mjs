import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase/app';
import * as authSdk from 'firebase/auth';
import { loadService } from './load-service.mjs';

const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
assert.match(host ?? '', /^127\.0\.0\.1:\d+$/);
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
