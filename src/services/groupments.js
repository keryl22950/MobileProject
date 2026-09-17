import { collection, doc, addDoc, updateDoc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function createGroupement({ groupId, createdBy, name, recurring, recurrenceHours, durationHours }) {
    const base = {
        name,
        recurring,
        recurrenceHours: recurring ? recurrenceHours : null,
        durationHours: recurring ? null : durationHours,
        createdBy,
        createdAt: serverTimestamp(),
    };

    // Un groupement récurrent démarre tout de suite (il cycle indéfiniment).
    // Un groupement ponctuel reste "en attente" jusqu'à ce qu'un admin appuie sur Start.
    if (recurring) {
        base.status = 'active';
        base.startedAt = serverTimestamp();
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

// Calcule la période actuelle (P0 pour un groupement ponctuel, P0/P1/P2... pour un
// récurrent). Renvoie null si le groupement ponctuel n'a pas encore été démarré.
export function getCurrentPeriod(groupement) {
    if (!groupement || !groupement.startedAt) return null;
    const startedAt = groupement.startedAt.toDate
        ? groupement.startedAt.toDate()
        : new Date(groupement.startedAt);
    const periodLengthHours = groupement.recurring ? groupement.recurrenceHours : groupement.durationHours;
    const periodLengthMs = periodLengthHours * 60 * 60 * 1000;

    if (!groupement.recurring) {
        return {
            periodKey: 'P0',
            periodIndex: 0,
            periodStart: startedAt,
            periodEnd: new Date(startedAt.getTime() + periodLengthMs),
        };
    }

    const elapsed = Date.now() - startedAt.getTime();
    const periodIndex = Math.max(0, Math.floor(elapsed / periodLengthMs));
    const periodStart = new Date(startedAt.getTime() + periodIndex * periodLengthMs);
    return {
        periodKey: `P${periodIndex}`,
        periodIndex,
        periodStart,
        periodEnd: new Date(periodStart.getTime() + periodLengthMs),
    };
}