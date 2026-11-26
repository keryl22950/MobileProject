import {
  collection,
  doc,
  getDocFromServer,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentPeriod } from './groupements';

const GROUP_LIMIT = 8;
const TARGET_LIMIT = 100;

export function createActivityId(uid) {
  return doc(collection(db, 'users', uid, 'activities')).id;
}

export function subscribeToServerPendingActivities(uid, callback) {
  const pending = query(collection(db, 'users', uid, 'activities'), where('pendingActivity', '==', true));
  return onSnapshot(
    pending,
    (snapshot) => callback(snapshot.docs.map((entry) => entry.data().request)),
    () => callback([])
  );
}

function dateOfActivity(date, now) {
  const result = date ? new Date(date) : now;
  if (!Number.isFinite(result.getTime()) || result > now) throw new Error('Date d’activité invalide.');
  return result;
}

async function loadTarget(read, target) {
  const eventRef = doc(db, 'groups', target.groupId, 'groupements', target.groupementId);
  const challengeRef = doc(eventRef, 'challenges', target.challengeId);
  const [event, challenge] = await Promise.all([read(eventRef), read(challengeRef)]);
  if (!event.exists() || !challenge.exists()) {
    throw new Error('Un événement ou challenge a été supprimé. Actualise la sélection.');
  }
  return { target, event: event.data(), challenge: challenge.data(), challengeRef };
}

function checkTarget({ target, event, challenge }, request, now, date) {
  const period = getCurrentPeriod(event, now);
  if (
    !period ||
    period.notStarted ||
    period.periodKey !== target.periodKey ||
    !(now < period.periodEnd) ||
    !(date >= period.periodStart && date < period.periodEnd)
  ) {
    throw new Error('La période sélectionnée a changé ou est terminée. Actualise les challenges avant de réessayer.');
  }
  if (request.presetId && (challenge.presetId !== request.presetId || challenge.unit !== request.unit)) {
    throw new Error('Un challenge a changé de type ou d’unité. Actualise la sélection.');
  }
}

function activityMetadata(request, challenge) {
  const metadata = request.presetId ? request : challenge;
  if (!metadata || !['presetId', 'label', 'icon', 'unit'].every((key) => typeof metadata[key] === 'string')) {
    throw new Error('Type d’activité invalide.');
  }
  const { presetId, label, icon, unit } = metadata;
  return { presetId, label, icon, unit };
}

function writeProfile(transaction, ref, request, metadata, date) {
  const first = request.targets.length === 1 ? request.targets[0] : {};
  const { uid, value, targets, externalId, source, durationMin } = request;
  const { presetId, icon, label, unit } = metadata;
  const data = {
    ...metadata,
    value,
    targets,
    createdAt: date,
    groupId: first.groupId || null,
    groupementId: first.groupementId || null,
    challengeId: first.challengeId || null,
  };
  if (externalId)
    Object.assign(data, { imported: true, externalId, source: source ?? null, durationMin: durationMin ?? null });
  transaction.set(ref, data);
  const statsKey = presetId === 'custom' ? first.challengeId || label : presetId;
  transaction.set(
    doc(db, 'users', uid, 'stats', statsKey),
    {
      icon,
      label,
      unit,
      total: increment(value),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

function writeContribution(transaction, { target, challengeRef }, request, date) {
  const { uid, userName, activityId, value } = request;
  const periodRef = doc(challengeRef, 'periods', target.periodKey);
  transaction.set(doc(periodRef, 'activities', uid + '_' + activityId), {
    userId: uid,
    userName,
    value,
    createdAt: date,
  });
  const progress = { name: userName, value: increment(value), updatedAt: serverTimestamp() };
  transaction.set(doc(periodRef, 'progress', uid), progress, { merge: true });
  transaction.set(doc(challengeRef, 'cumulative', uid), progress, { merge: true });
}

function checkpointOf(snapshot) {
  if (!snapshot.exists()) return -1;
  return snapshot.data().pendingActivity ? snapshot.data().nextTarget : Infinity;
}

async function prepareLargeActivity(ref, request) {
  const existing = await getDocFromServer(ref);
  if (existing.exists()) return;
  const confirmedAt = new Date();
  const date = dateOfActivity(request.date, confirmedAt);
  const metadata = activityMetadata(request);

  // Valider toute la sélection avant la première contribution, par petits groupes de lectures.
  for (let start = 0; start < request.targets.length; start += 12) {
    const loaded = await Promise.all(
      request.targets.slice(start, start + 12).map((target) => loadTarget(getDocFromServer, target))
    );
    for (const target of loaded) checkTarget(target, request, confirmedAt, date);
  }
  const { uid, userName, activityId, value, targets, externalId, source, durationMin } = request;
  const stored = {
    ...metadata,
    uid,
    userName,
    activityId,
    value,
    targets,
    date: date.toISOString(),
    externalId: externalId ?? null,
    source: source ?? null,
    durationMin: durationMin ?? null,
  };
  await runTransaction(db, async (transaction) => {
    if ((await transaction.get(ref)).exists()) return;
    // Sans createdAt ni imported, ce document reste hors de l’historique et des imports terminés.
    transaction.set(ref, {
      pendingActivity: true,
      request: stored,
      confirmedAt: confirmedAt.toISOString(),
      nextTarget: 0,
    });
  });
}

function nextBatch(targets, start) {
  const groupId = targets[start].groupId;
  let end = start + 1;
  while (end < targets.length && end - start < 25 && targets[end].groupId === groupId) end++;
  return targets.slice(start, end);
}

export async function saveActivity(args) {
  const { uid, activityId, value, externalId } = args;
  if (!uid || !activityId || activityId.includes('/')) throw new Error('Identifiant d’activité invalide.');
  if (!Number.isFinite(value) || value <= 0) throw new Error('Indique une valeur finie supérieure à 0.');
  if (externalId && externalId !== activityId) throw new Error('Identifiant d’import incohérent.');

  const targets = [
    ...new Map(
      (args.targets || []).map(({ groupId, groupementId, challengeId, periodKey }) => [
        [groupId, groupementId, challengeId].join('/'),
        { groupId, groupementId, challengeId, periodKey },
      ])
    ).values(),
  ];
  const request = { ...args, targets };
  const ref = doc(db, 'users', uid, 'activities', activityId);
  const large = targets.length > TARGET_LIMIT || new Set(targets.map((target) => target.groupId)).size > GROUP_LIMIT;
  if (large) await prepareLargeActivity(ref, request);
  return finishActivity(ref, request);
}

async function finishActivity(ref, request) {
  for (;;) {
    let checkpoint;
    try {
      const result = await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        checkpoint = checkpointOf(snapshot);
        if (checkpoint === Infinity) return 'already-saved';

        const pending = snapshot.data();
        const currentRequest = pending?.request ?? request;
        const targets = pending ? nextBatch(currentRequest.targets, checkpoint) : currentRequest.targets;
        const loaded = [];
        for (const target of targets) loaded.push(await loadTarget((targetRef) => transaction.get(targetRef), target));
        // Une reprise garde l’heure de la confirmation et la période validée à ce moment.
        const now = pending ? new Date(pending.confirmedAt) : new Date();
        const date = dateOfActivity(currentRequest.date, now);
        for (const target of loaded) checkTarget(target, currentRequest, now, date);

        const end = Math.max(checkpoint, 0) + targets.length;
        const complete = end === currentRequest.targets.length;
        if (complete) {
          writeProfile(transaction, ref, currentRequest, activityMetadata(currentRequest, loaded[0]?.challenge), date);
        } else {
          transaction.set(ref, { nextTarget: end }, { merge: true });
        }
        for (const target of loaded) writeContribution(transaction, target, currentRequest, date);
        return complete ? 'saved' : 'next-batch';
      });
      if (result !== 'next-batch') return result === 'saved';
    } catch (error) {
      // Le journal est en création seule. En concurrence ou si la réponse est perdue,
      // seule l’avancée du point de reprise sur le serveur confirme que le lot est passé.
      let latest;
      try {
        latest = checkpointOf(await getDocFromServer(ref));
      } catch {
        throw error;
      }
      if (latest === Infinity) return false;
      if (checkpoint === undefined || latest <= checkpoint) throw error;
    }
  }
}
