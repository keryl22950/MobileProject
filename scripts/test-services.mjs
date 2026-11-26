import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadService } from './load-service.mjs';

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

async function healthService(hasDistance) {
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
      readRecords: async (type) => {
        calls.push(type);
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
