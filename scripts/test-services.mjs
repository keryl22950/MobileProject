import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadService } from './load-service.mjs';
import { planInvitations } from './migrate-group-invitations.mjs';

test('Firebase sépare les émulateurs, le projet de développement et la production', async () => {
  const previous = globalThis.__DEV__;
  const keys = ['PROJECT_ID', 'API_KEY', 'APP_ID'].map((key) => 'EXPO_PUBLIC_FIREBASE_DEV_' + key);
  const saved = keys.map((key) => process.env[key]);
  async function initialize(channel, projectId) {
    const calls = [];
    globalThis.__DEV__ = false;
    for (const [i, value] of [projectId, 'test-key', 'test-app'].entries()) process.env[keys[i]] = value;
    await loadService('firebase.js', {
      'firebase/app': {
        initializeApp: (config) => {
          calls.push(config.projectId);
          return {};
        },
      },
      'firebase/firestore': { getFirestore: () => ({}), connectFirestoreEmulator: () => calls.push('firestore') },
      'firebase/auth': {
        initializeAuth: () => ({}),
        getReactNativePersistence: () => ({}),
        signInAnonymously: async () => {},
        onAuthStateChanged: () => {},
        connectAuthEmulator: () => calls.push('auth'),
      },
      '@react-native-async-storage/async-storage': { default: {} },
      'react-native': { Platform: { OS: 'android' } },
      'expo-updates': { channel },
    });
    return calls;
  }
  try {
    assert.deepEqual(await initialize('preview', 'custom-dev'), ['mobileproject-c534a']);
    assert.deepEqual(await initialize('development', 'custom-dev'), ['custom-dev']);
    assert.deepEqual(await initialize('development', 'mobileproject-c534a'), [
      'demo-challengeapp',
      'firestore',
      'auth',
    ]);
  } finally {
    if (previous === undefined) delete globalThis.__DEV__;
    else globalThis.__DEV__ = previous;
    keys.forEach((key, i) => {
      if (saved[i] === undefined) delete process.env[key];
      else process.env[key] = saved[i];
    });
  }
});

test('La migration conserve les codes uniques et bloque les collisions et les index incohérents', () => {
  const { conflicts, missing } = planInvitations(
    [
      { groupId: 'a', code: 'ABCDEF' },
      { groupId: 'b', code: 'BCDEFG' },
      { groupId: 'c', code: 'BCDEFG' },
      { groupId: 'd', code: 'CDEFGH' },
      { groupId: 'e', code: 'DEFGHJ' },
      { groupId: 'f', code: 'invalid' },
    ],
    new Map([
      ['CDEFGH', 'different'],
      ['DEFGHJ', 'e'],
    ])
  );
  assert.deepEqual(missing, [{ code: 'ABCDEF', groupId: 'a' }]);
  assert.equal(conflicts.length, 3);
  assert.deepEqual(conflicts.find((entry) => entry.groupIds?.includes('b')).groupIds, ['b', 'c']);
});

test('Les annonces natives respectent versions numériques, plateformes et liens HTTPS', async () => {
  let path;
  const api = await loadService('appReleases.js', {
    'firebase/firestore': {
      doc: (_, ...segments) => {
        path = segments.join('/');
        return path;
      },
      onSnapshot: (_, callback) => {
        callback({ exists: () => false });
        return () => {};
      },
    },
    './firebase': { db: {} },
  });
  const release = { version: '1.10.0', installUrl: 'https://expo.dev/builds/example' };
  assert.deepEqual(api.newerNativeRelease(release, '1.9.0'), release);
  for (const installed of ['1.10.0', '2.0.0', null, 'fingerprint']) {
    assert.equal(api.newerNativeRelease(release, installed), null);
  }
  for (const installUrl of ['http://example.com', 'javascript:alert(1)', 'https://user:pass@example.com', 'invalid']) {
    assert.equal(api.newerNativeRelease({ ...release, installUrl }, '1.0.0'), null);
  }
  assert.equal(api.newerNativeRelease({ ...release, version: 'bad' }, '1.0.0'), null);
  let result = 'unset';
  api.subscribeToAppRelease('preview', 'ios', (value) => {
    result = value;
  });
  assert.equal(path, 'appReleases/preview_ios');
  assert.equal(result, null);
  path = null;
  api.subscribeToAppRelease('development', 'android', () => assert.fail());
  assert.equal(path, null);
});

async function healthService(hasDistance, readPage) {
  const calls = [];
  const api = await loadService('healthConnect.js', {
    'react-native': { Platform: { OS: 'android' } },
    'react-native-health-connect': {
      initialize: async () => true,
      getSdkStatus: async () => 3,
      SdkAvailabilityStatus: { SDK_AVAILABLE: 3 },
      ExerciseType: { RUNNING: 1 },
      requestPermission: async () => [
        { recordType: 'ExerciseSession' },
        ...(hasDistance ? [{ recordType: 'Distance' }] : []),
      ],
      readRecords: async (type, filter) => {
        calls.push(type);
        if (readPage) return readPage(type, filter);
        if (type === 'Distance') {
          assert.ok(hasDistance, 'Lecture interdite sans permission');
          return {
            records: [
              { startTime: '2026-11-24T08:00:00Z', endTime: '2026-11-24T08:30:00Z', distance: { inMeters: 5000 } },
            ],
          };
        }
        return {
          records: [
            {
              exerciseType: 1,
              startTime: '2026-11-24T08:00:00Z',
              endTime: '2026-11-24T08:30:00Z',
              metadata: { id: 'session-1' },
            },
          ],
        };
      },
    },
  });
  return { api, calls };
}

test('Sans permission Distance, les séances restent disponibles pour saisie manuelle', async () => {
  const { api, calls } = await healthService(false);
  const ready = await api.ensureHealthConnectReady();
  const sessions = await api.readRecentSessions(ready);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].distanceKm, null);
  assert.deepEqual(calls, ['ExerciseSession']);
});

test('Avec permission Distance, la distance est chargée en kilomètres', async () => {
  const { api, calls } = await healthService(true);
  const sessions = await api.readRecentSessions(await api.ensureHealthConnectReady());
  assert.equal(sessions[0].distanceKm, 5);
  assert.deepEqual(calls, ['ExerciseSession', 'Distance']);
});

test('Une séance utilise une seule source de distance et ignore ses relevés qui se recouvrent', async () => {
  const startTime = '2026-11-24T08:00:00Z';
  const endTime = '2026-11-24T08:30:00Z';
  const session = { exerciseType: 1, startTime, endTime, metadata: { id: 'run', dataOrigin: 'watch' } };
  const distance = (dataOrigin, meters, end = endTime) => ({
    startTime,
    endTime: end,
    metadata: { dataOrigin },
    distance: { inMeters: meters },
  });
  const { api } = await healthService(true, (type) => ({
    records:
      type === 'ExerciseSession'
        ? [session]
        : [distance('watch', 5000), distance('watch', 2500, '2026-11-24T08:15:00Z'), distance('phone', 7000)],
  }));
  assert.equal((await api.readRecentSessions({ hasDistance: true }))[0].distanceKm, 5);
  session.metadata.dataOrigin = 'unknown';
  const fallback = await healthService(true, (type) => ({
    records:
      type === 'ExerciseSession'
        ? [session]
        : [distance('watch', 2500, '2026-11-24T08:15:00Z'), distance('phone', 7000)],
  }));
  assert.equal((await fallback.api.readRecentSessions({ hasDistance: true }))[0].distanceKm, 7);
});

test('Le chat sélectionne les 200 messages récents puis les affiche chronologiquement', async () => {
  const docs = Array.from({ length: 205 }, (_, i) => ({ id: String(i), data: () => ({ createdAt: i }) }));
  const unused = () => {
    throw new Error('Appel inattendu');
  };
  const firestore = Object.fromEntries(
    [
      'arrayUnion',
      'arrayRemove',
      'doc',
      'addDoc',
      'getDoc',
      'getDocs',
      'where',
      'serverTimestamp',
      'updateDoc',
      'writeBatch',
      'runTransaction',
    ].map((key) => [key, unused])
  );
  const onError = () => {};
  const unsubscribe = () => {};
  Object.assign(firestore, {
    collection: () => docs,
    orderBy: (field, direction) => ({ field, direction }),
    limit: (count) => ({ count }),
    query: (items, sort, bound) =>
      items
        .slice()
        .sort((a, b) => (a.data()[sort.field] - b.data()[sort.field]) * (sort.direction === 'desc' ? -1 : 1))
        .slice(0, bound.count),
    onSnapshot: (selected, callback, errorCallback) => {
      assert.equal(errorCallback, onError);
      callback({ docs: selected });
      return unsubscribe;
    },
  });
  const api = await loadService('groups.js', { 'firebase/firestore': firestore, './firebase': { db: {} } });
  let messages;
  assert.equal(
    api.subscribeToMessages(
      'group',
      (value) => {
        messages = value;
      },
      onError
    ),
    unsubscribe
  );
  assert.equal(messages.length, 200);
  assert.equal(messages[0].id, '5');
  assert.equal(messages.at(-1).id, '204');
  assert.ok(messages.every((message, i) => i === 0 || Number(message.id) > Number(messages[i - 1].id)));
});
