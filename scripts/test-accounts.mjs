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
