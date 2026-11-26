const assert = require('node:assert/strict');
const { after, test } = require('node:test');
const { setTimeout: wait } = require('node:timers/promises');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^127\.0\.0\.1:\d+$/);
const app = initializeApp({ projectId: 'demo-challengeapp' });
const db = getFirestore(app);
after(() => deleteApp(app));

async function waitForDeletion(...refs) {
  const deadline = Date.now() + 20_000;
  do {
    const entries = await db.getAll(...refs);
    if (entries.every((entry) => !entry.exists)) return;
    await wait(200);
  } while (Date.now() < deadline);
  assert.fail('Le nettoyage ne s’est pas terminé avant le délai.');
}

test('Les suppressions de challenge, événement et groupe retirent seulement leurs descendants', async () => {
  const group = db.doc('groups/cleanup');
  const event = group.collection('groupements').doc('event');
  const challenge = event.collection('challenges').doc('challenge');
  const score = challenge.collection('cumulative').doc('member');
  const journal = challenge.collection('periods').doc('P0').collection('activities').doc('run');
  const invite = db.doc('groupInvites/CLEANUP234');
  const otherGroup = db.doc('groups/other');
  const message = group.collection('messages').doc('message');
  await Promise.all([
    group.set({ inviteCode: 'CLEANUP234' }),
    event.set({}),
    challenge.set({}),
    score.set({}),
    journal.set({}),
    invite.set({ groupId: group.id }),
    otherGroup.set({}),
    message.set({}),
  ]);
  await challenge.delete();
  await waitForDeletion(score, journal);
  assert.ok((await event.get()).exists);

  const secondChallenge = event.collection('challenges').doc('second');
  await secondChallenge.set({});
  await event.delete();
  await waitForDeletion(secondChallenge);
  assert.ok((await message.get()).exists);

  await group.delete();
  await waitForDeletion(invite, message);
  assert.ok((await otherGroup.get()).exists);
});
