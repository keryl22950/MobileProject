import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentPeriod } from './groupements';

// Pour une activité de type `presetId` réalisée à la date `at`, renvoie :
// - matches : les challenges qui peuvent la compter (période en cours de l'événement)
// - skipped : les événements écartés, avec la raison
export async function findChallengesForSession({ uid, presetId, at = new Date() }) {
    const groupsSnap = await getDocs(query(collection(db, 'groups'), where('memberIds', 'array-contains', uid)));
    const matches = [];
    const skipped = [];
    const now = new Date();

    for (const groupDoc of groupsSnap.docs) {
        const group = { id: groupDoc.id, ...groupDoc.data() };
        const groupementsSnap = await getDocs(collection(db, 'groups', group.id, 'groupements'));

        for (const groupementDoc of groupementsSnap.docs) {
            const groupement = { id: groupementDoc.id, ...groupementDoc.data() };
            const label = `${group.name} → ${groupement.name}`;
            const current = getCurrentPeriod(groupement, now);
            const atPeriod = getCurrentPeriod(groupement, at);

            if (!current) { skipped.push({ label, reason: "événement pas encore démarré" }); continue; }
            if (current.notStarted) { skipped.push({ label, reason: "l'événement n'a pas encore commencé" }); continue; }
            if (!groupement.recurring && current.periodEnd.getTime() < now.getTime()) {
                skipped.push({ label, reason: 'événement terminé' });
                continue;
            }
            if (!atPeriod || atPeriod.notStarted) {
                skipped.push({ label, reason: "la séance a eu lieu avant le démarrage de l'événement" });
                continue;
            }
            if (atPeriod.periodKey !== current.periodKey) {
                skipped.push({ label, reason: 'la séance appartient à une période passée' });
                continue;
            }

            const challengesSnap = await getDocs(
                collection(db, 'groups', group.id, 'groupements', groupement.id, 'challenges')
            );
            const found = challengesSnap.docs.filter((d) => d.data().presetId === presetId);

            if (found.length === 0) {
                skipped.push({ label, reason: 'aucun challenge de ce type dans cet événement' });
                continue;
            }

            found.forEach((challengeDoc) => {
                const challenge = challengeDoc.data();
                matches.push({
                    groupId: group.id,
                    groupName: group.name,
                    groupementId: groupement.id,
                    groupementName: groupement.name,
                    challengeId: challengeDoc.id,
                    challengeLabel: challenge.label,
                    unit: challenge.unit,
                    periodKey: current.periodKey,
                });
            });
        }
    }

    return { matches, skipped };
}

// Utilisé par l'enregistrement rapide (inchangé pour ses appelants).
export async function findActiveChallengesForPreset(args) {
    const { matches } = await findChallengesForSession(args);
    return matches;
}