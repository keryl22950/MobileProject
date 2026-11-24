import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadService } from './load-service.mjs';

const request = { uid: 'alice', activityId: 'one', value: 5, targets: [{ challengeId: 'original' }] };
function storage() {
  const data = new Map();
  return {
    getAllKeys: async () => [...data.keys()],
    getItem: async (key) => data.get(key) ?? null,
    multiGet: async (keys) => keys.map((key) => [key, data.get(key) ?? null]),
    setItem: async (key, value) => {
      data.set(key, value);
    },
    removeItem: async (key) => {
      data.delete(key);
    },
  };
}
const load = (disk, saveActivity) =>
  loadService('pendingActivities.js', {
    '@react-native-async-storage/async-storage': { default: disk },
    './activities': { saveActivity },
  });

test('Après redémarrage, une reprise conserve identifiant, valeur, date et cibles', async () => {
  const disk = storage();
  const first = await load(disk, async () => {
    throw new Error('offline');
  });
  await assert.rejects(first.savePendingActivity(request), /offline/);
  const [persisted] = await first.listPendingActivities('alice');
  assert.ok(persisted.date);
  const restarted = await load(disk, async (args) => {
    assert.deepEqual(args, persisted);
    return true;
  });
  await restarted.savePendingActivity({ ...request, value: 99, targets: [] });
  assert.deepEqual(await restarted.listPendingActivities('alice'), []);
});

test('Un stockage local défaillant empêche tout envoi réseau', async () => {
  const disk = storage();
  disk.setItem = async () => {
    throw new Error('disk full');
  };
  const service = await load(disk, async () => assert.fail('Network must not be called'));
  await assert.rejects(service.savePendingActivity(request), /disk full/);
});

test('La suppression locale après un succès peut échouer sans provoquer un double enregistrement', async () => {
  const disk = storage();
  const remove = disk.removeItem;
  disk.removeItem = async () => {
    throw new Error('cleanup failed');
  };
  const service = await load(disk, async () => true);
  await assert.rejects(service.savePendingActivity(request), /cleanup failed/);
  disk.removeItem = remove;
  const restarted = await load(disk, async () => false); // Déjà enregistré côté serveur.
  await restarted.savePendingActivity(request);
  assert.deepEqual(await restarted.listPendingActivities('alice'), []);
});

test('Deux validations simultanées partagent un seul envoi et ne peuvent pas être retirées en cours', async () => {
  const disk = storage();
  let calls = 0,
    finish;
  const waiting = new Promise((resolve) => {
    finish = resolve;
  });
  const service = await load(disk, async () => {
    calls++;
    await waiting;
    return true;
  });
  const first = service.savePendingActivity(request);
  const second = service.savePendingActivity(request);
  assert.equal(first, second);
  await assert.rejects(service.discardPendingActivity('alice', 'one'), /Attends/);
  finish();
  await first;
  assert.equal(calls, 1);
});

test('Les comptes sont isolés et retirer une copie locale ne touche pas au serveur', async () => {
  const disk = storage();
  const service = await load(disk, async () => {
    throw new Error('offline');
  });
  await assert.rejects(service.savePendingActivity(request));
  await assert.rejects(service.savePendingActivity({ ...request, uid: 'bob' }));
  assert.equal((await service.listPendingActivities('alice')).length, 1);
  await service.discardPendingActivity('alice', 'one');
  assert.equal((await service.listPendingActivities('alice')).length, 0);
  assert.equal((await service.listPendingActivities('bob')).length, 1);
});

test('Une période périmée conserve la tentative et des identifiants distincts ne se perdent pas', async () => {
  const service = await load(storage(), async () => {
    throw new Error('expired');
  });
  await Promise.allSettled([
    service.savePendingActivity(request),
    service.savePendingActivity({ ...request, activityId: 'two' }),
  ]);
  assert.equal((await service.listPendingActivities('alice')).length, 2);
  await assert.rejects(service.savePendingActivity({ ...request, value: NaN }), /invalide/);
});
