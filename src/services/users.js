import { collection, doc, setDoc, getDoc, getDocs, query, where, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
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