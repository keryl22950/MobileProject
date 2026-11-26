import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  readRecords,
  getSdkStatus,
  SdkAvailabilityStatus,
  ExerciseType,
} from 'react-native-health-connect';

// Types d'exercice Health Connect → nos presets. On lit les valeurs depuis
// ExerciseType (ce sont des nombres) et on ignore les noms qui n'existeraient
// pas dans ta version de la librairie.
const TYPE_NAMES_TO_PRESET = [
  ['RUNNING', 'running'],
  ['RUNNING_TREADMILL', 'running'],
  ['BIKING', 'cycling'],
  ['BIKING_STATIONARY', 'cycling'],
  ['SWIMMING_POOL', 'swimming'],
  ['SWIMMING_OPEN_WATER', 'swimming'],
  ['SKIING', 'skiing'],
];

const TYPE_TO_PRESET = {};
TYPE_NAMES_TO_PRESET.forEach(([name, presetId]) => {
  const value = ExerciseType?.[name];
  if (value !== undefined) TYPE_TO_PRESET[value] = presetId;
});

const SOURCE_LABELS = {
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.withings.wiscale2': 'Withings',
};

function toMeters(length) {
  if (!length) return 0;
  // Format de ta version de la librairie : { inMeters, inKilometers, ... }
  if (typeof length.inMeters === 'number') return length.inMeters;
  if (typeof length.inKilometers === 'number') return length.inKilometers * 1000;
  // Repli sur l'ancien format { value, unit }
  const v = length.value ?? 0;
  switch (length.unit) {
    case 'kilometers':
      return v * 1000;
    case 'miles':
      return v * 1609.344;
    case 'feet':
      return v * 0.3048;
    case 'inches':
      return v * 0.0254;
    default:
      return v;
  }
}

function sessionDistance(start, end, sessionOrigin, records) {
  const byOrigin = new Map();
  const maxDuration = Math.max((end - start) * 2, 10 * 60 * 1000);
  for (const record of records) {
    const recordStart = Date.parse(record.startTime);
    const recordEnd = Date.parse(record.endTime);
    const duration = recordEnd - recordStart;
    const from = Math.max(start.getTime(), recordStart);
    const to = Math.min(end.getTime(), recordEnd);
    const meters = toMeters(record.distance);
    if (!(duration > 0 && duration <= maxDuration && to > from && Number.isFinite(meters) && meters > 0)) continue;
    const origin = record.metadata?.dataOrigin ?? '';
    if (!byOrigin.has(origin)) byOrigin.set(origin, []);
    byOrigin.get(origin).push({ from, to, metersPerMs: meters / duration });
  }
  const candidates = [];
  for (const [origin, intervals] of byOrigin) {
    let coveredUntil = -Infinity;
    let coverage = 0;
    let meters = 0;
    // N’ajoute qu’une fois chaque portion de temps, même si une source
    // fournit des échantillons qui chevauchent un relevé récapitulatif.
    intervals.sort((a, b) => a.from - b.from || b.to - a.to);
    for (const { from, to, metersPerMs } of intervals) {
      const uncovered = to - Math.max(from, coveredUntil);
      if (uncovered <= 0) continue;
      coverage += uncovered;
      meters += metersPerMs * uncovered;
      coveredUntil = to;
    }
    candidates.push({ origin, coverage, meters });
  }
  const ownSource = sessionOrigin && candidates.find(({ origin }) => origin === sessionOrigin);
  const best = ownSource || candidates.sort((a, b) => b.coverage - a.coverage || a.origin.localeCompare(b.origin))[0];
  return best ? best.meters / 1000 : null;
}

function sameSession(a, b) {
  if (a.id === b.id) return true;
  if (!a.origin || !b.origin || a.origin === b.origin || a.presetId !== b.presetId) return false;
  const overlap = Math.min(a.endTime, b.endTime) - Math.max(a.startTime, b.startTime);
  return (
    Math.abs(a.startTime - b.startTime) <= 60000 &&
    Math.abs(a.endTime - b.endTime) <= 60000 &&
    overlap >= 0.9 * Math.max(a.endTime - a.startTime, b.endTime - b.startTime)
  );
}

export async function ensureHealthConnectReady() {
  if (Platform.OS !== 'android') {
    throw new Error("L'import depuis une montre est disponible uniquement sur Android pour l'instant.");
  }

  const status = await getSdkStatus();
  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
    throw new Error(
      "Health Connect n'est pas disponible. Installe ou mets à jour l'application « Health Connect » depuis le Play Store."
    );
  }
  const ok = await initialize();
  if (!ok) throw new Error("Impossible d'initialiser Health Connect.");

  const granted = await requestPermission([
    { accessType: 'read', recordType: 'ExerciseSession' },
    { accessType: 'read', recordType: 'Distance' },
  ]);
  if (!granted.some((p) => p.recordType === 'ExerciseSession')) {
    throw new Error("Permission refusée : l'accès aux séances d'exercice est nécessaire.");
  }

  // Sans la permission Distance, les séances s'affichent mais sans distance : on le signale.
  return { hasDistance: granted.some((p) => p.recordType === 'Distance') };
}

async function readAllRecords(type, filter) {
  const records = [];
  const seen = new Set();
  let pageToken;
  do {
    const page = await readRecords(type, pageToken ? { ...filter, pageToken } : filter);
    records.push(...(page.records || []));
    pageToken = page.pageToken;
    if (pageToken && seen.has(pageToken)) throw new Error('Health Connect a renvoyé la même page. Réessaie.');
    if (pageToken) seen.add(pageToken);
  } while (pageToken);
  return records;
}

// Séances des `days` derniers jours, tous appareils confondus, dédoublonnées.
export async function readRecentSessions({ days = 7, hasDistance = false } = {}) {
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const filter = {
    timeRangeFilter: { operator: 'between', startTime: since.toISOString(), endTime: now.toISOString() },
  };

  const [exercises, distances] = await Promise.all([
    readAllRecords('ExerciseSession', filter),
    hasDistance ? readAllRecords('Distance', filter) : [],
  ]);

  const sessions = exercises
    .map((s) => {
      const presetId = TYPE_TO_PRESET[s.exerciseType];
      if (!presetId) return null;

      const start = new Date(s.startTime);
      const end = new Date(s.endTime);
      if (!(end > start)) return null;
      const origin = s.metadata?.dataOrigin;
      return {
        id: s.metadata?.id || s.startTime,
        presetId,
        origin,
        startTime: start,
        endTime: end,
        durationMin: Math.round((end - start) / 60000),
        distanceKm: sessionDistance(start, end, origin, distances),
        sourceLabel: SOURCE_LABELS[origin] || 'Autre application',
      };
    })
    .filter(Boolean);

  // L’identifiant ne change pas selon la permission Distance ou l’ordre des pages.
  sessions.sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
  const clusters = [];
  for (const session of sessions) {
    const cluster = clusters.find((entries) => entries.every((entry) => sameSession(entry, session)));
    if (cluster) cluster.push(session);
    else clusters.push([session]);
  }
  return clusters.reverse().map((entries) => {
    const [first] = entries;
    const representative = entries.find((entry) => entry.distanceKm !== null) || first;
    const { presetId, sourceLabel, distanceKm, durationMin } = representative;
    return {
      id: first.id,
      recordIds: [...new Set(entries.map((entry) => entry.id))],
      startTime: first.startTime,
      presetId,
      sourceLabel,
      distanceKm,
      durationMin,
    };
  });
}
