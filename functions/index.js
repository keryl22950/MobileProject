const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { cleanDeletedDocument } = require('./cleanup');

initializeApp();

function cleanupOnDelete(document) {
  return onDocumentDeleted({ document, retry: true }, ({ data, params }) =>
    cleanDeletedDocument(getFirestore(), data, params)
  );
}

exports.cleanDeletedGroup = cleanupOnDelete('groups/{groupId}');
exports.cleanDeletedEvent = cleanupOnDelete('groups/{groupId}/groupements/{groupementId}');
exports.cleanDeletedChallenge = cleanupOnDelete('groups/{groupId}/groupements/{groupementId}/challenges/{challengeId}');
