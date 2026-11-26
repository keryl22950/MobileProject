async function cleanDeletedDocument(db, snapshot, { groupId, groupementId, challengeId }) {
  if (!snapshot) return;
  const group = db.collection('groups').doc(groupId);
  const event = groupementId ? group.collection('groupements').doc(groupementId) : null;
  // La suppression du parent nettoie aussi ses descendants. Les événements
  // générés par ce nettoyage ne doivent pas relancer la même suppression.
  if (groupementId && !(await group.get()).exists) return;
  if (challengeId && !(await event.get()).exists) return;
  if ((await snapshot.ref.get()).exists) return;

  for (const subcollection of await snapshot.ref.listCollections()) {
    await db.recursiveDelete(subcollection);
  }

  if (!groupementId) {
    const code = snapshot.data().inviteCode;
    if (typeof code !== 'string' || !/^[A-Z2-9]{6}([A-Z2-9]{4})?$/.test(code)) return;
    const invite = db.collection('groupInvites').doc(code);
    await db.runTransaction(async (transaction) => {
      const record = await transaction.get(invite);
      const currentGroup = await transaction.get(group);
      if (!currentGroup.exists && record.data()?.groupId === groupId) transaction.delete(invite);
    });
  }
}

module.exports = { cleanDeletedDocument };
