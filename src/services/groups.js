import {
  arrayUnion,
  arrayRemove,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  orderBy,
  serverTimestamp,
  updateDoc,
  limit,
  writeBatch,
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

export async function createGroup({ uid, userName, name }) {
  const inviteCode = generateInviteCode();

  const groupRef = doc(collection(db, 'groups'));
  const batch = writeBatch(db);
  batch.set(groupRef, {
    name,
    inviteCode,
    ownerId: uid,
    memberIds: [uid],
    createdAt: serverTimestamp(),
  });

  // Le créateur du groupe devient automatiquement "creator" (rôle le plus élevé).
  batch.set(doc(groupRef, 'members', uid), {
    name: userName,
    role: 'creator',
    joinedAt: serverTimestamp(),
  });
  await batch.commit();

  return groupRef.id;
}

export async function joinGroupByCode({ uid, userName, code }) {
  const cleanCode = code.trim().toUpperCase();
  const snap = await getDocs(query(collection(db, 'groups'), where('inviteCode', '==', cleanCode)));

  if (snap.empty) {
    throw new Error('Aucun groupe ne correspond à ce code.');
  }

  const groupDoc = snap.docs[0];
  const memberRef = doc(groupDoc.ref, 'members', uid);
  const alreadyJoined = groupDoc.data().memberIds.includes(uid);
  if (alreadyJoined && (await getDoc(memberRef)).exists()) return groupDoc.id;

  const batch = writeBatch(db);
  if (!alreadyJoined) batch.update(groupDoc.ref, { memberIds: arrayUnion(uid) });
  batch.set(memberRef, {
    name: userName,
    role: groupDoc.data().ownerId === uid ? 'creator' : 'participant',
    joinedAt: serverTimestamp(),
  });
  await batch.commit();

  return groupDoc.id;
}

// Liste des groupes où l'utilisateur courant est membre (pour l'écran d'accueil).
export function subscribeToMyGroups(uid, callback) {
  const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      if (error.code !== 'permission-denied') console.error(error);
    }
  );
}

export function subscribeToGroup(groupId, callback) {
  return onSnapshot(
    doc(db, 'groups', groupId),
    (snap) => {
      if (snap.exists()) callback({ id: snap.id, ...snap.data() });
    },
    (error) => {
      if (error.code !== 'permission-denied') console.error(error);
    }
  );
}

// Membres du groupe, avec leur rôle. Triés par date d'arrivée.
export function subscribeToMembers(groupId, callback) {
  const q = query(collection(db, 'groups', groupId, 'members'), orderBy('joinedAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      if (error.code !== 'permission-denied') console.error(error);
    }
  );
}

// Seul un admin/créateur peut changer le rôle d'un membre (les règles
// Firestore l'imposent aussi côté serveur).
export async function updateMemberRole({ groupId, memberId, role }) {
  await updateDoc(doc(db, 'groups', groupId, 'members', memberId), { role });
}

export function roleLabel(role) {
  switch (role) {
    case 'creator':
      return 'Créateur';
    case 'admin':
      return 'Admin';
    default:
      return 'Participant';
  }
}

export async function sendMessage({ groupId, uid, userName, text }) {
  await addDoc(collection(db, 'groups', groupId, 'messages'), {
    userId: uid,
    userName,
    text,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToMessages(groupId, callback, onError) {
  const q = query(collection(db, 'groups', groupId, 'messages'), orderBy('createdAt', 'desc'), limit(200));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse());
    },
    onError
  );
}

export async function updateGroup({ groupId, changes }) {
  await updateDoc(doc(db, 'groups', groupId), changes);
}

// Un membre quitte le groupe. S'il ne reste plus personne, le groupe est
// supprimé entièrement. S'il était créateur et qu'il reste des membres, le
// rôle est transmis en priorité à un admin existant, sinon au premier
// participant restant.
export async function leaveGroup({ groupId, uid }) {
  const groupRef = doc(db, 'groups', groupId);
  const { ownerId, memberIds } = (await getDoc(groupRef)).data();
  const batch = writeBatch(db);
  batch.delete(doc(groupRef, 'members', uid));
  const groupDeleted = ownerId === uid && memberIds.length === 1;

  if (groupDeleted) {
    batch.delete(groupRef);
  } else if (ownerId === uid) {
    const membersSnap = await getDocs(query(collection(groupRef, 'members'), orderBy('joinedAt', 'asc')));
    const remaining = membersSnap.docs.filter((member) => member.id !== uid && memberIds.includes(member.id));
    const nextCreator = remaining.find((member) => member.data().role === 'admin') || remaining[0];
    if (!nextCreator) throw new Error('Aucun membre disponible pour reprendre le groupe.');
    batch.update(nextCreator.ref, { role: 'creator' });
    batch.update(groupRef, { memberIds: arrayRemove(uid), ownerId: nextCreator.id });
  } else {
    batch.update(groupRef, { memberIds: arrayRemove(uid) });
  }

  await batch.commit();
  return { groupDeleted };
}
