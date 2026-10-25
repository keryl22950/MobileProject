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
        case 'kilometers': return v * 1000;
        case 'miles': return v * 1609.344;
        case 'feet': return v * 0.3048;
        case 'inches': return v * 0.0254;
        default: return v;
    }
}

export async function ensureHealthConnectReady() {
    if (Platform.OS !== 'android') {
        throw new Error("L'import depuis une montre est disponible uniquement sur Android pour l'instant.");
    }

    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
        throw new Error("Health Connect n'est pas disponible. Installe ou mets à jour l'application « Health Connect » depuis le Play Store.");
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

// Séances des `days` derniers jours, tous appareils confondus, dédoublonnées.
export async function readRecentSessions({ days = 7 } = {}) {
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const filter = { timeRangeFilter: { operator: 'between', startTime: since.toISOString(), endTime: now.toISOString() } };

    const sessionsRes = await readRecords('ExerciseSession', filter);
    const distancesRes = await readRecords('Distance', filter);
    const distances = distancesRes.records || [];

    const sessions = (sessionsRes.records || []).map((s) => {
        const presetId = TYPE_TO_PRESET[s.exerciseType];
        if (!presetId) return null;

        const start = new Date(s.startTime);
        const end = new Date(s.endTime);
        // Distance = relevés qui chevauchent la séance, au prorata du temps commun.
        // On ignore les relevés beaucoup plus longs que la séance (totaux de la journée).
        const sessionMs = Math.max(end - start, 1);
        const meters = distances.reduce((acc, d) => {
            const dStart = new Date(d.startTime);
            const dEnd = new Date(d.endTime);
            const dMs = dEnd - dStart;
            if (dMs <= 0 || dMs > Math.max(sessionMs * 2, 10 * 60 * 1000)) return acc;
            const overlap = Math.min(dEnd, end) - Math.max(dStart, start);
            if (overlap <= 0) return acc;
            return acc + toMeters(d.distance) * (overlap / dMs);
        }, 0);

        const origin = s.metadata?.dataOrigin;
        return {
            id: s.metadata?.id || s.startTime,
            presetId,
            startTime: start,
            durationMin: Math.round((end - start) / 60000),
            distanceKm: meters > 0 ? meters / 1000 : null,
            sourceLabel: SOURCE_LABELS[origin] || 'Autre application',
        };
    }).filter(Boolean);

    // Même séance vue par deux applis : on garde une seule entrée (de préférence avec distance).
    sessions.sort((a, b) => a.startTime - b.startTime);
    const unique = [];
    sessions.forEach((s) => {
        const dupIndex = unique.findIndex(
            (u) => u.presetId === s.presetId && Math.abs(u.startTime - s.startTime) < 10 * 60 * 1000
        );
        if (dupIndex === -1) unique.push(s);
        else if (unique[dupIndex].distanceKm == null && s.distanceKm != null) unique[dupIndex] = s;
    });

    return unique.reverse(); // plus récentes d'abord
}