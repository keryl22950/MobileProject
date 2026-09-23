import { collection, doc, addDoc, setDoc, getDoc, getDocs, query, where, orderBy, limit, increment, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function upsertUserProfile({ uid, displayName }) {
    await setDoc(doc(db, 'users', uid), {
        displayName,
        nameLower: displayName.toLowerCase(),
        updatedAt: serverTimestamp(),
    }, { merge: true });
}

export async function searchUsersByName(prefix) {
    const lower = prefix.trim().toLowerCase();
    if (!lower) return [];
    const q = query(
        collection(db, 'users'),
        where('nameLower', '>=', lower),
        where('nameLower', '<=', lower + '\uf8ff'),
        limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addFriend({ uid, friendUid }) {
    await setDoc(doc(db, 'users', uid, 'friends', friendUid), { addedAt: serverTimestamp() });
}

export function subscribeToFriends(uid, callback) {
    return onSnapshot(collection(db, 'users', uid, 'friends'), async (snap) => {
        const friendIds = snap.docs.map((d) => d.id);
        const profiles = await Promise.all(friendIds.map(async (fid) => {
            const userSnap = await getDoc(doc(db, 'users', fid));
            return userSnap.exists() ? { id: fid, ...userSnap.data() } : { id: fid, displayName: '?' };
        }));
        callback(profiles);
    });
}

export function subscribeToUserStats(uid, callback) {
    return onSnapshot(collection(db, 'users', uid, 'stats'), (snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
}

// Enregistre une activité au niveau du profil (historique façon Strava) et met
// à jour le cumul par type. groupId/groupementId/challengeId sont optionnels :
// null quand l'activité n'a pu être rattachée à aucun challenge.
export async function recordUserActivity({ uid, presetId, label, icon, unit, value, groupId, groupementId, challengeId }) {
    await addDoc(collection(db, 'users', uid, 'activities'), {
        presetId, label, icon, unit, value,
        groupId: groupId || null, groupementId: groupementId || null, challengeId: challengeId || null,
        createdAt: serverTimestamp(),
    });

    const statsKey = presetId === 'custom' ? (challengeId || label) : presetId;
    await setDoc(
        doc(db, 'users', uid, 'stats', statsKey),
        { icon, label, unit, total: increment(value), updatedAt: serverTimestamp() },
        { merge: true }
    );
}

export function subscribeToUserActivities(uid, callback) {
    const q = query(collection(db, 'users', uid, 'activities'), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}