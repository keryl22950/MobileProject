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

export async function createGroup({ uid, userName, name }) {
  const inviteCode = generateInviteCode();

  const groupRef = await addDoc(collection(db, 'groups'), {
    name,
    inviteCode,
    ownerId: uid,
    memberIds: [uid],
    createdAt: serverTimestamp(),
  });

  // Le créateur du groupe devient automatiquement "creator" (rôle le plus élevé).
  await setDoc(doc(db, 'groups', groupRef.id, 'members', uid), {
    name: userName,
    role: 'creator',
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

  if (!existingMemberIds.includes(uid)) {
    await updateDoc(doc(db, 'groups', groupDoc.id), {
      memberIds: [...existingMemberIds, uid],
    });
  }

  // Les personnes qui rejoignent via code arrivent en tant que "participant".
  await setDoc(
    doc(db, 'groups', groupDoc.id, 'members', uid),
    { name: userName, role: 'participant', joinedAt: serverTimestamp() },
    { merge: true }
  );

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

// Membres du groupe, avec leur rôle. Triés par date d'arrivée.
export function subscribeToMembers(groupId, callback) {
  const q = query(collection(db, 'groups', groupId, 'members'), orderBy('joinedAt', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
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
