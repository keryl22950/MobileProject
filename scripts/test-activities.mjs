import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import * as firestore from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { loadService } from './load-service.mjs';

// Même suite contre une transaction simulée (npm test) ou les vrais émulateurs.
const useEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const apps = [];
after(async () => {
  await Promise.all(apps.map(deleteApp));
});

async function fixture(beforeTransaction = () => {}) {
  let api,
    db,
    uid = 'user';
  if (useEmulators) {
    assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST);
    const app = initializeApp({ projectId: 'demo-challengeapp', apiKey: 'demo-key' }, `activity-${apps.length}`);
    apps.push(app);
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
    uid = (await signInAnonymously(auth)).user.uid;
    db = firestore.getFirestore(app);
    const host = new URL(`http://${process.env.FIRESTORE_EMULATOR_HOST}`);
    firestore.connectFirestoreEmulator(db, host.hostname, Number(host.port));
    api = firestore;
  } else {
    const store = new Map();
    let version = 0;
    const ref = (parent, ...segments) => ({ path: [parent.path, ...segments].filter(Boolean).join('/') });
    const snapshot = (reference) => ({
      exists: () => store.has(reference.path),
      data: () => store.get(reference.path),
    });
    const apply = (reference, data, options) => {
      const previous = store.get(reference.path) || {};
      const next = options?.merge ? { ...previous } : {};
      for (const [key, value] of Object.entries(data))
        next[key] = value?.increment !== undefined ? (previous[key] || 0) + value.increment : value;
      store.set(reference.path, next);
      version++;
    };
    api = {
      ...firestore,
      doc: ref,
      collection: ref,
      increment: (value) => ({ increment: value }),
      serverTimestamp: () => new Date(),
      getDoc: async (reference) => snapshot(reference),
      getDocFromServer: async (reference) => snapshot(reference),
      setDoc: async (...args) => apply(...args),
      runTransaction: async (_, callback) => {
        for (let attempt = 0; attempt < 10; attempt++) {
          const initialVersion = version;
          const writes = [];
          const result = await callback({
            get: async (reference) => {
              assert.equal(writes.length, 0, 'Read after write');
              return snapshot(reference);
            },
            set: (...args) => writes.push(args),
          });
          if (initialVersion !== version) continue;
          // Les journaux existants sont en création seule dans firestore.rules.
          if (
            writes.some(
              ([reference]) =>
                reference.path.includes('/periods/') &&
                reference.path.includes('/activities/') &&
                store.has(reference.path)
            )
          ) {
            throw Object.assign(new Error('permission-denied'), { code: 'permission-denied' });
          }
          writes.forEach((args) => apply(...args));
          return result;
        }
        throw new Error('Too much contention');
      },
    };
    db = {};
  }
  const periods = await loadService('groupements.js', { 'firebase/firestore': api, './firebase': { db } });
  const service = await loadService('activities.js', {
    'firebase/firestore': {
      ...api,
      runTransaction: (...args) => {
        beforeTransaction();
        return api.runTransaction(...args);
      },
    },
    './firebase': { db },
    './groupements': periods,
  });
  const groupId = `group-${uid}`;
  const groupRef = api.doc(db, 'groups', groupId);
  await api.setDoc(groupRef, { ownerId: uid, memberIds: [uid], name: 'Test', inviteCode: uid });
  const eventRef = api.doc(groupRef, 'groupements', 'event');
  await api.setDoc(eventRef, { startedAt: new Date(Date.now() - 60000), durationHours: 1, recurring: false });
  const metadata = { presetId: 'running', label: 'Course', icon: 'run', unit: 'km' };
  const target = { groupId, groupementId: 'event', challengeId: 'one', periodKey: 'P0' };
  for (const id of ['one', 'two']) await api.setDoc(api.doc(eventRef, 'challenges', id), metadata);
  const args = { uid, userName: 'Test', activityId: 'activity', value: 5, ...metadata, targets: [target] };
  const history = api.doc(db, 'users', uid, 'activities', args.activityId);
  const stats = api.doc(db, 'users', uid, 'stats', 'running');
  const score = (id = 'one') => api.doc(eventRef, 'challenges', id, 'periods', 'P0', 'progress', uid);
  const get = async (reference) => (await api.getDoc(reference)).data();
  return { api, db, uid, service, periods, args, target, eventRef, history, stats, score, get };
}

test('Une activité alimente tous les challenges et un seul total de profil', async () => {
  const f = await fixture();
  await f.service.saveActivity({ ...f.args, targets: [f.target, { ...f.target, challengeId: 'two' }, f.target] });
  assert.equal((await f.get(f.stats)).total, 5);
  assert.equal((await f.get(f.score())).value, 5);
  assert.equal((await f.get(f.score('two'))).value, 5);
  assert.equal((await f.get(f.history)).targets.length, 2);
  const cumulative = f.api.doc(f.eventRef, 'challenges', 'one', 'cumulative', f.uid);
  assert.equal((await f.get(cumulative)).value, 5);
});

test('Deux imports simultanés et une reprise ne comptent qu’une fois', async () => {
  const f = await fixture();
  const args = { ...f.args, externalId: 'activity' };
  const results = await Promise.all([f.service.saveActivity(args), f.service.saveActivity(args)]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(await f.service.saveActivity(args), false);
  assert.equal((await f.get(f.stats)).total, 5);
  assert.equal((await f.get(f.score())).value, 5);
  assert.equal((await f.get(f.history)).imported, true);
});

test('Un refus d’écriture du journal annule aussi historique, stats et classement', async () => {
  const f = await fixture();
  await f.api.setDoc(f.api.doc(f.eventRef, 'challenges', 'one', 'periods', 'P0', 'activities', `${f.uid}_activity`), {
    userId: f.uid,
    userName: 'Test',
    value: 1,
  });
  await assert.rejects(f.service.saveActivity(f.args), { code: 'permission-denied' });
  assert.equal(await f.get(f.history), undefined);
  assert.equal(await f.get(f.stats), undefined);
  assert.equal(await f.get(f.score()), undefined);
});

test('Une cible disparue ne laisse aucune contribution et permet une nouvelle tentative', async () => {
  const f = await fixture();
  await assert.rejects(
    f.service.saveActivity({ ...f.args, targets: [f.target, { ...f.target, challengeId: 'missing' }] })
  );
  assert.equal(await f.get(f.history), undefined);
  assert.equal(await f.get(f.score()), undefined);
  await f.service.saveActivity(f.args);
  assert.equal((await f.get(f.stats)).total, 5);
});

test('Une période expirée pendant la confirmation est refusée sans marquer l’import', async () => {
  const f = await fixture();
  await f.api.setDoc(f.eventRef, { startedAt: new Date(Date.now() - 3600000), durationHours: 1, recurring: false });
  await assert.rejects(f.service.saveActivity({ ...f.args, externalId: 'activity' }), /période/);
  assert.equal(await f.get(f.history), undefined);
});

test('La nouvelle période récurrente et une séance passée ne sont pas confondues', async () => {
  const f = await fixture();
  await f.api.setDoc(f.eventRef, { startedAt: new Date(Date.now() - 5400000), recurrenceHours: 1, recurring: true });
  await assert.rejects(f.service.saveActivity(f.args), /période/);
  await assert.rejects(
    f.service.saveActivity({
      ...f.args,
      date: new Date(Date.now() - 3600000),
      targets: [{ ...f.target, periodKey: 'P1' }],
    }),
    /période/
  );
  assert.equal(await f.get(f.history), undefined);
});

test('Saisie directe : les métadonnées sont lues dans le challenge', async () => {
  const f = await fixture();
  const { presetId, label, icon, unit, ...args } = f.args;
  await f.service.saveActivity(args);
  assert.equal((await f.get(f.history)).presetId, 'running');
});

test('Profil seul et valeurs invalides', async () => {
  const f = await fixture();
  for (const value of [NaN, Infinity, 0, -1]) await assert.rejects(f.service.saveActivity({ ...f.args, value }));
  assert.equal(await f.get(f.history), undefined);
  await f.service.saveActivity({ ...f.args, targets: [] });
  assert.equal((await f.get(f.stats)).total, 5);
});

test('Une activité sur neuf groupes reprend au lot suivant après une interruption', async () => {
  let transactions = 0;
  const f = await fixture(() => {
    if (++transactions === 3) throw new Error('connexion perdue');
  });
  const targets = await Promise.all(
    Array.from({ length: 9 }, async (_, i) => {
      const groupId = f.uid + '-batch-' + i;
      const group = f.api.doc(f.db, 'groups', groupId);
      const event = f.api.doc(group, 'groupements', 'event');
      await f.api.setDoc(group, { ownerId: f.uid, memberIds: [f.uid], name: 'Test' });
      await f.api.setDoc(event, { startedAt: new Date(Date.now() - 60000), durationHours: 1, recurring: false });
      await f.api.setDoc(f.api.doc(event, 'challenges', 'one'), {
        presetId: 'running',
        label: 'Course',
        icon: 'run',
        unit: 'km',
      });
      return { ...f.target, groupId };
    })
  );
  const args = { ...f.args, targets, externalId: f.args.activityId };
  const score = (index) =>
    f.api.doc(
      f.db,
      'groups',
      targets[index].groupId,
      'groupements',
      'event',
      'challenges',
      'one',
      'periods',
      'P0',
      'progress',
      f.uid
    );
  await assert.rejects(f.service.saveActivity(args), /connexion perdue/);
  assert.equal((await f.get(f.history)).nextTarget, 1);
  assert.equal((await f.get(f.history)).imported, undefined);
  assert.equal(await f.get(f.stats), undefined);
  assert.equal((await f.get(score(0))).value, 5);
  assert.equal(await f.get(score(1)), undefined);
  // Une sélection différente sur un autre appareil reprend la demande initiale.
  await Promise.all([f.service.saveActivity(args), f.service.saveActivity({ ...args, targets: [], value: 99 })]);
  assert.equal((await f.get(f.history)).targets.length, 9);
  assert.equal((await f.get(f.history)).imported, true);
  assert.equal((await f.get(f.stats)).total, 5);
  for (let i = 0; i < 9; i++) assert.equal((await f.get(score(i))).value, 5);
});

test('La limite de 100 challenges dans 8 groupes respecte les règles actuelles', async () => {
  const f = await fixture();
  const targets = [];
  for (let group = 0; group < 8; group++) {
    const groupId = `${f.uid}-limit-${group}`;
    await f.api.setDoc(f.api.doc(f.db, 'groups', groupId), { ownerId: f.uid, memberIds: [f.uid], name: 'Test' });
    const event = f.api.doc(f.db, 'groups', groupId, 'groupements', 'event');
    await f.api.setDoc(event, { startedAt: new Date(Date.now() - 60000), durationHours: 1, recurring: false });
    for (let i = group; i < 100; i += 8) {
      await f.api.setDoc(f.api.doc(event, 'challenges', String(i)), {
        presetId: 'running',
        label: 'Course',
        icon: 'run',
        unit: 'km',
      });
      targets.push({ groupId, groupementId: 'event', challengeId: String(i), periodKey: 'P0' });
    }
  }
  await f.service.saveActivity({ ...f.args, targets });
  assert.equal((await f.get(f.history)).targets.length, 100);
  assert.equal((await f.get(f.stats)).total, 5);
});

test('Un changement d’unité est refusé et les anciennes activités ne sont pas rejouées', async () => {
  const f = await fixture();
  await f.api.setDoc(f.api.doc(f.eventRef, 'challenges', 'one'), {
    presetId: 'running',
    label: 'Course',
    icon: 'run',
    unit: 'm',
  });
  await assert.rejects(f.service.saveActivity(f.args), /unité/);
  assert.equal(await f.get(f.history), undefined);
  await f.api.setDoc(f.history, { value: 5, imported: true, externalId: 'activity' });
  assert.equal(await f.service.saveActivity(f.args), false);
  assert.equal(await f.get(f.stats), undefined);
});

test('Les frontières de période sont inclusives au début et exclusives à la fin', async () => {
  const f = await fixture();
  const start = new Date('2026-11-24T08:00:00Z');
  const event = { startedAt: start, recurring: true, recurrenceHours: 1 };
  assert.equal(f.periods.getCurrentPeriod(event, start).periodKey, 'P0');
  assert.equal(f.periods.getCurrentPeriod(event, new Date('2026-11-24T08:59:59.999Z')).periodKey, 'P0');
  assert.equal(f.periods.getCurrentPeriod(event, new Date('2026-11-24T09:00:00Z')).periodKey, 'P1');
});
