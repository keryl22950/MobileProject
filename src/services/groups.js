import { arrayUnion, arrayRemove,
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
  limit, deleteDoc,
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
  const snap = await getDocs(query(collection(db, 'groups'), where('inviteCode', '==', cleanCode)));

  if (snap.empty) {
    throw new Error('Aucun groupe ne correspond à ce code.');
  }

  const groupDoc = snap.docs[0];
  // Déjà membre : rien à écrire (et surtout pas de rôle à écraser).
  if ((groupDoc.data().memberIds || []).includes(uid)) return groupDoc.id;

  // arrayUnion : atomique, même si deux personnes rejoignent en même temps.
  await updateDoc(doc(db, 'groups', groupDoc.id), { memberIds: arrayUnion(uid) });

  await setDoc(doc(db, 'groups', groupDoc.id, 'members', uid), {
    name: userName,
    role: 'participant',
    joinedAt: serverTimestamp(),
  });

  return groupDoc.id;
}

// Liste des groupes où l'utilisateur courant est membre (pour l'écran d'accueil).
export function subscribeToMyGroups(uid, callback) {
    const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', uid));
    return onSnapshot(
        q,
        (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (error) => { if (error.code !== 'permission-denied') console.error(error); }
    );
}

export function subscribeToGroup(groupId, callback) {
    return onSnapshot(
        doc(db, 'groups', groupId),
        (snap) => { if (snap.exists()) callback({ id: snap.id, ...snap.data() }); },
        (error) => { if (error.code !== 'permission-denied') console.error(error); }
    );
}

// Membres du groupe, avec leur rôle. Triés par date d'arrivée.
export function subscribeToMembers(groupId, callback) {
    const q = query(collection(db, 'groups', groupId, 'members'), orderBy('joinedAt', 'asc'));
    return onSnapshot(
        q,
        (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (error) => { if (error.code !== 'permission-denied') console.error(error); }
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

// ajoute getDoc à l'import existant de 'firebase/firestore'

export async function updateGroup({ groupId, changes }) {
  await updateDoc(doc(db, 'groups', groupId), changes);
}

// Un membre quitte le groupe. S'il ne reste plus personne, le groupe est
// supprimé entièrement. S'il était créateur et qu'il reste des membres, le
// rôle est transmis en priorité à un admin existant, sinon au premier
// participant restant.
export async function leaveGroup({ groupId, uid }) {
  const membersSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
  const members = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const me = members.find((m) => m.id === uid);
  const remaining = members.filter((m) => m.id !== uid);

  if (remaining.length === 0) {
    await deleteDoc(doc(db, 'groups', groupId, 'members', uid));
    await deleteDoc(doc(db, 'groups', groupId));
    return { groupDeleted: true };
  }

  // L'ordre compte : promotion et mise à jour du groupe AVANT de supprimer mon propre
  // document membre, sinon les règles ne me reconnaissent plus comme admin.
  if (me?.role === 'creator') {
    const nextCreator = remaining.find((m) => m.role === 'admin') || remaining[0];
    await setDoc(doc(db, 'groups', groupId, 'members', nextCreator.id), { role: 'creator' }, { merge: true });
    await updateDoc(doc(db, 'groups', groupId), { memberIds: arrayRemove(uid), ownerId: nextCreator.id });
  } else {
    await updateDoc(doc(db, 'groups', groupId), { memberIds: arrayRemove(uid) });
  }

  await deleteDoc(doc(db, 'groups', groupId, 'members', uid));
  return { groupDeleted: false };
}