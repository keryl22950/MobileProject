import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadService } from './load-service.mjs';
import { planInvitations } from './migrate-group-invitations.mjs';

test('QuickLog ne lit que les challenges de l’activité choisie', async () => {
  const now = new Date();
  const fixtures = {
    groups: [{ id: 'group', name: 'Amis', memberIds: ['user'] }],
    'groups/group/groupements': [{ id: 'event', name: 'Événement' }],
    'groups/group/groupements/event/challenges': [
      { id: 'run', presetId: 'running', label: 'Course', unit: 'km' },
      { id: 'bike', presetId: 'cycling' },
      { id: 'swim', presetId: 'swimming' },
      { id: 'pushups', presetId: 'pushups' },
    ],
  };
  let challengeReads = 0;
  const service = await loadService('quickLog.js', {
    'firebase/firestore': {
      collection: (_, ...parts) => ({ path: parts.join('/') }),
      where: (field, operator, value) => ({ field, operator, value }),
      query: (collection, filter) => ({ ...collection, filter }),
      getDocs: async ({ path, filter }) => {
        const rows = fixtures[path].filter(
          (row) =>
            !filter ||
            (filter.operator === 'array-contains'
              ? row[filter.field].includes(filter.value)
              : row[filter.field] === filter.value)
        );
        if (path.endsWith('/challenges')) challengeReads += rows.length;
        return { docs: rows.map((row) => ({ id: row.id, data: () => row })) };
      },
    },
    './firebase': { db: {} },
    './groupements': { getCurrentPeriod: () => ({ periodKey: 'P0', periodEnd: new Date(now.getTime() + 60000) }) },
  });
  const matches = await service.findActiveChallengesForPreset({ uid: 'user', presetId: 'running', at: now });
  assert.deepEqual(
    matches.map((match) => match.challengeId),
    ['run']
  );
  assert.equal(challengeReads, 1);
});

test('Quitter le suivi GPS avant la fin du démarrage libère le maintien d’écran et le GPS', async () => {
  const calls = [];
  let finishWatch;
  let watchStarted;
  const starting = new Promise((resolve) => {
    watchStarted = resolve;
  });
  const watch = new Promise((resolve) => {
    finishWatch = resolve;
  });
  const api = await loadService('foregroundGps.js', {
    'expo-location': {
      requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
      Accuracy: { BestForNavigation: 6 },
      watchPositionAsync: (...args) => {
        watchStarted(args);
        return watch;
      },
    },
    'expo-keep-awake': {
      activateKeepAwakeAsync: async (tag) => calls.push(['activate', tag]),
      deactivateKeepAwake: async (tag) => calls.push(['deactivate', tag]),
    },
    '../utils/geo': { distanceKm: () => 1 },
  });
  const session = api.startForegroundGps(
    () => assert.fail('Session arrêtée'),
    () => assert.fail('Session arrêtée')
  );
  const [, onPosition] = await starting;
  session.stop();
  onPosition({ coords: { latitude: 48, longitude: 2, accuracy: 5 } });
  finishWatch({ remove: () => calls.push(['remove']) });
  await session.ready;
  assert.deepEqual(
    calls.map(([action]) => action),
    ['activate', 'deactivate', 'remove']
  );
  assert.equal(calls[0][1], calls[1][1]);
});

test('Un échec de démarrage GPS désactive le maintien d’écran et laisse remonter l’erreur', async () => {
  let released = false;
  const api = await loadService('foregroundGps.js', {
    'expo-location': {
      requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
      Accuracy: { BestForNavigation: 6 },
      watchPositionAsync: async () => {
        throw new Error('GPS indisponible');
      },
    },
    'expo-keep-awake': {
      activateKeepAwakeAsync: async () => {},
      deactivateKeepAwake: async () => {
        released = true;
      },
    },
    '../utils/geo': { distanceKm: () => 0 },
  });
  const session = api.startForegroundGps(
    () => {},
    () => {}
  );
  await assert.rejects(session.ready, /GPS indisponible/);
  assert.equal(released, true);
});

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

test('Deux sources quasi identiques partagent les alias, deux séances rapprochées restent distinctes', async () => {
  const session = (id, dataOrigin, start, end) => ({
    exerciseType: 1,
    startTime: '2026-11-24T08:' + start + 'Z',
    endTime: '2026-11-24T08:' + end + 'Z',
    metadata: { id, dataOrigin },
  });
  const records = [
    session('watch-first', 'watch', '00:00', '07:00'),
    session('phone-copy', 'phone', '00:10', '07:10'),
    session('watch-second', 'watch', '08:00', '16:00'),
  ];
  const { api } = await healthService(false, () => ({ records: [...records].reverse() }));
  const result = await api.readRecentSessions();
  assert.deepEqual(
    result.map(({ id, recordIds }) => ({ id, recordIds })),
    [
      { id: 'watch-second', recordIds: ['watch-second'] },
      { id: 'watch-first', recordIds: ['watch-first', 'phone-copy'] },
    ]
  );
});

test('Les pages Health Connect de séances et de distances sont suivies séparément', async () => {
  const startTime = '2026-11-24T08:00:00Z';
  const endTime = '2026-11-24T08:30:00Z';
  const calls = [];
  const { api } = await healthService(true, (type, options) => {
    calls.push([type, options.pageToken]);
    if (!options.pageToken) return { records: [], pageToken: type + '2' };
    assert.equal(options.pageToken, type + '2');
    return {
      records: [
        type === 'ExerciseSession'
          ? { exerciseType: 1, startTime, endTime, metadata: { id: 'second-page' } }
          : { startTime, endTime, distance: { inMeters: 4000 } },
      ],
    };
  });
  const sessions = await api.readRecentSessions({ days: 30, hasDistance: true });
  assert.deepEqual(
    sessions.map(({ id, distanceKm }) => ({ id, distanceKm })),
    [{ id: 'second-page', distanceKm: 4 }]
  );
  assert.equal(calls.length, 4);
  const looping = await healthService(false, () => ({ pageToken: 'same' }));
  await assert.rejects(looping.api.readRecentSessions(), /même page/);
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
