import {
    collection,
    doc,
    addDoc,
    setDoc,
    getDocs,
    query,
    where,
    onSnapshot,
    orderBy,
    serverTimestamp,
    updateDoc,
    increment,
    limit,
} from 'firebase/firestore';
import { db } from './firebase';

// Génère un code court, sans caractères ambigus (I/O/0/1), pour inviter
// facilement à l'oral ou par SMS.
function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

export async function createGroup({
                                      uid,
                                      userName,
                                      presetId,
                                      label,
                                      icon,
                                      unit,
                                      target,
                                      durationHours,
                                  }) {
    const deadline = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    const inviteCode = generateInviteCode();

    const groupRef = await addDoc(collection(db, 'groups'), {
        presetId,
        label,
        icon,
        unit,
        target,
        durationHours,
        inviteCode,
        ownerId: uid,
        memberIds: [uid],
        createdAt: serverTimestamp(),
        deadline,
    });

    await setDoc(doc(db, 'groups', groupRef.id, 'members', uid), {
        name: userName,
        progress: 0,
        joinedAt: serverTimestamp(),
    });

    return groupRef.id;
}

export async function joinGroupByCode({ uid, userName, code }) {
    const cleanCode = code.trim().toUpperCase();
    const q = query(collection(db, 'groups'), where('inviteCode', '==', cleanCode));
    const snap = await getDocs(q);

    if (snap.empty) {
        throw new Error('Aucun groupe ne correspond à ce code.');
    }

    const groupDoc = snap.docs[0];
    const existingMemberIds = groupDoc.data().memberIds || [];

    await setDoc(
        doc(db, 'groups', groupDoc.id, 'members', uid),
        { name: userName, progress: 0, joinedAt: serverTimestamp() },
        { merge: true }
    );

    if (!existingMemberIds.includes(uid)) {
        await updateDoc(doc(db, 'groups', groupDoc.id), {
            memberIds: [...existingMemberIds, uid],
        });
    }

    return groupDoc.id;
}

// Liste des groupes où l'utilisateur courant est membre (pour l'écran d'accueil).
export function subscribeToMyGroups(uid, callback) {
    const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', uid));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
}

export function subscribeToGroup(groupId, callback) {
    return onSnapshot(doc(db, 'groups', groupId), (snap) => {
        if (snap.exists()) callback({ id: snap.id, ...snap.data() });
    });
}

// Classement du groupe, triés par progression décroissante.
export function subscribeToMembers(groupId, callback) {
    const q = query(collection(db, 'groups', groupId, 'members'), orderBy('progress', 'desc'));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
}

export async function logActivity({ groupId, uid, userName, value }) {
    await addDoc(collection(db, 'groups', groupId, 'activities'), {
        userId: uid,
        userName,
        value,
        createdAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'groups', groupId, 'members', uid), {
        progress: increment(value),
    });
}

export function subscribeToActivities(groupId, callback) {
    const q = query(
        collection(db, 'groups', groupId, 'activities'),
        orderBy('createdAt', 'desc'),
        limit(50)
    );
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
}

export async function sendMessage({ groupId, uid, userName, text }) {
    await addDoc(collection(db, 'groups', groupId, 'messages'), {
        userId: uid,
        userName,
        text,
        createdAt: serverTimestamp(),
    });
}

export function subscribeToMessages(groupId, callback) {
    const q = query(
        collection(db, 'groups', groupId, 'messages'),
        orderBy('createdAt', 'asc'),
        limit(200)
    );
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
}