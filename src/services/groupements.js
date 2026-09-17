import { collection, doc, addDoc, updateDoc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function createGroupement({ groupId, createdBy, name, recurring, recurrenceHours, durationHours, startedAt }) {
    const base = {
        name,
        recurring,
        recurrenceHours: recurring ? recurrenceHours : null,
        durationHours: recurring ? null : durationHours,
        createdBy,
        createdAt: serverTimestamp(),
    };

    if (recurring) {
        // L'admin choisit quand démarre la toute première période (peut être
        // dans le futur, ex : "dimanche prochain à minuit"). Les périodes
        // suivantes s'enchaînent automatiquement à partir de cette date.
        base.status = 'active';
        base.startedAt = startedAt;
    } else {
        base.status = 'pending';
        base.startedAt = null;
    }

    const ref = await addDoc(collection(db, 'groups', groupId, 'groupements'), base);
    return ref.id;
}

export async function startGroupement({ groupId, groupementId }) {
    await updateDoc(doc(db, 'groups', groupId, 'groupements', groupementId), {
        status: 'active',
        startedAt: serverTimestamp(),
    });
}

export async function updateGroupement({ groupId, groupementId, changes }) {
    await updateDoc(doc(db, 'groups', groupId, 'groupements', groupementId), changes);
}

export function subscribeToGroupements(groupId, callback) {
    const q = query(collection(db, 'groups', groupId, 'groupements'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export function subscribeToGroupement(groupId, groupementId, callback) {
    return onSnapshot(doc(db, 'groups', groupId, 'groupements', groupementId), (snap) => {
        if (snap.exists()) callback({ id: snap.id, ...snap.data() });
    });
}

// Calcule la période actuelle. Cas particuliers :
// - non récurrent pas encore démarré → null
// - récurrent dont la date de départ est dans le futur → { notStarted: true, periodEnd: <date de départ> }
export function getCurrentPeriod(groupement) {
    if (!groupement || !groupement.startedAt) return null;
    const startedAt = groupement.startedAt.toDate
        ? groupement.startedAt.toDate()
        : new Date(groupement.startedAt);
    const periodLengthHours = groupement.recurring ? groupement.recurrenceHours : groupement.durationHours;
    const periodLengthMs = periodLengthHours * 60 * 60 * 1000;

    if (Date.now() < startedAt.getTime()) {
        return { periodKey: null, periodIndex: -1, periodStart: null, periodEnd: startedAt, notStarted: true };
    }

    if (!groupement.recurring) {
        return {
            periodKey: 'P0',
            periodIndex: 0,
            periodStart: startedAt,
            periodEnd: new Date(startedAt.getTime() + periodLengthMs),
        };
    }

    const elapsed = Date.now() - startedAt.getTime();
    const periodIndex = Math.floor(elapsed / periodLengthMs);
    const periodStart = new Date(startedAt.getTime() + periodIndex * periodLengthMs);
    return {
        periodKey: `P${periodIndex}`,
        periodIndex,
        periodStart,
        periodEnd: new Date(periodStart.getTime() + periodLengthMs),
    };
}