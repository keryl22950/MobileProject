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
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import { createPagedFeed } from './pagedFeed';
import { subscriptionErrors } from './subscriptionErrors';

// Génère un code court, sans caractères ambigus (I/O/0/1), pour inviter
// facilement à l'oral ou par SMS.
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createGroup({ uid, userName, name }) {
  const groupRef = doc(collection(db, 'groups'));
  const group = { name, ownerId: uid, memberIds: [uid], createdAt: serverTimestamp() };
  const memberRef = doc(groupRef, 'members', uid);
  const member = { name: userName, role: 'creator', joinedAt: serverTimestamp() };
  for (let attempt = 0; attempt < 5; attempt++) {
    const inviteCode = generateInviteCode();
    const inviteRef = doc(db, 'groupInvites', inviteCode);
    const created = await runTransaction(db, async (transaction) => {
      let invite;
      try {
        invite = await transaction.get(inviteRef);
      } catch (error) {
        if (error.code === 'permission-denied') return 'legacy';
        throw error;
      }
      if (invite.exists()) return false;
      transaction.set(groupRef, { ...group, inviteCode });
      transaction.set(memberRef, member);
      transaction.set(inviteRef, { groupId: groupRef.id });
      return true;
    });
    if (created === 'legacy') {
      const batch = writeBatch(db);
      batch.set(groupRef, { ...group, inviteCode });
      batch.set(memberRef, member);
      await batch.commit();
    }
    if (created) return groupRef.id;
  }
  throw new Error('Impossible de réserver un code d’invitation. Réessaie.');
}

async function findGroupForInvitation(code) {
  let invite;
  try {
    invite = await getDoc(doc(db, 'groupInvites', code));
  } catch (error) {
    if (error.code !== 'permission-denied') throw error;
  }
  if (invite?.exists()) return { ref: doc(db, 'groups', invite.data().groupId), indexed: true };

  // Transition : les groupes historiques peuvent ne pas encore avoir d’entrée dans l’index.
  try {
    const groups = await getDocs(query(collection(db, 'groups'), where('inviteCode', '==', code), limit(2)));
    if (groups.size === 1) return { ref: groups.docs[0].ref, data: groups.docs[0].data(), indexed: false };
    if (groups.size > 1) throw new Error('Ce code correspond à plusieurs groupes. Demande un nouveau code.');
  } catch (error) {
    if (error.code !== 'permission-denied') throw error;
  }
  throw new Error('Aucun groupe ne correspond à ce code.');
}

export async function joinGroupByCode({ uid, userName, code }) {
  const cleanCode = code.trim().toUpperCase();
  if (!/^[A-Z2-9]{6}([A-Z2-9]{4})?$/.test(cleanCode)) throw new Error('Vérifie le code d’invitation saisi.');
  const { ref, indexed, data } = await findGroupForInvitation(cleanCode);
  let group = data;
  if (indexed) {
    try {
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) throw new Error('Ce groupe n’existe plus.');
      group = snapshot.data();
    } catch (error) {
      // Une personne invitée n’a pas encore accès au groupe en mode privé.
      if (error.code !== 'permission-denied') throw error;
    }
  }

  const memberRef = doc(ref, 'members', uid);
  const alreadyJoined = group?.memberIds.includes(uid);
  if (alreadyJoined && (await getDoc(memberRef)).exists()) return ref.id;

  const batch = writeBatch(db);
  if (!alreadyJoined) batch.update(ref, { memberIds: arrayUnion(uid) });
  batch.set(memberRef, {
    name: userName,
    role: group?.ownerId === uid ? 'creator' : 'participant',
    joinedAt: serverTimestamp(),
    ...(indexed ? { inviteCode: cleanCode } : {}),
  });
  try {
    await batch.commit();
  } catch (error) {
    if (error.code !== 'permission-denied') throw error;
    // Une seconde validation simultanée peut arriver après la création de la fiche.
    const member = await getDoc(memberRef);
    if (!member.exists()) throw error;
  }
  return ref.id;
}

// Liste des groupes où l'utilisateur courant est membre (pour l'écran d'accueil).
export function subscribeToMyGroups(uid, callback, onError) {
  const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    subscriptionErrors('mes groupes', onError)
  );
}

export function subscribeToGroup(groupId, callback, onError) {
  return onSnapshot(
    doc(db, 'groups', groupId),
    (snap) => {
      if (snap.exists()) callback({ id: snap.id, ...snap.data() });
    },
    subscriptionErrors('groupe', onError)
  );
}

// Membres du groupe, avec leur rôle. Triés par date d'arrivée.
export function subscribeToMembers(groupId, callback, onError) {
  const q = query(collection(db, 'groups', groupId, 'members'), orderBy('joinedAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    subscriptionErrors('membres', onError)
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

export function getMessageFeed(groupId) {
  return createPagedFeed(collection(db, 'groups', groupId, 'messages'), 200);
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
