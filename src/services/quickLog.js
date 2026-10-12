import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentPeriod } from './groupements';

// Trouve les challenges qui peuvent recevoir une activité du type `presetId`
// réalisée à la date `at` (maintenant par défaut). Pour ne jamais réécrire
// l'histoire, l'activité doit tomber dans la période EN COURS de l'événement.
export async function findActiveChallengesForPreset({ uid, presetId, at = new Date() }) {
    const groupsSnap = await getDocs(query(collection(db, 'groups'), where('memberIds', 'array-contains', uid)));
    const results = [];
    const now = new Date();

    for (const groupDoc of groupsSnap.docs) {
        const group = { id: groupDoc.id, ...groupDoc.data() };
        const groupementsSnap = await getDocs(collection(db, 'groups', group.id, 'groupements'));

        for (const groupementDoc of groupementsSnap.docs) {
            const groupement = { id: groupementDoc.id, ...groupementDoc.data() };
            const current = getCurrentPeriod(groupement, now);
            const atPeriod = getCurrentPeriod(groupement, at);

            if (!current || current.notStarted) continue;
            if (!atPeriod || atPeriod.notStarted) continue;
            if (atPeriod.periodKey !== current.periodKey) continue;
            if (!groupement.recurring && current.periodEnd.getTime() < now.getTime()) continue;

            const challengesSnap = await getDocs(
                collection(db, 'groups', group.id, 'groupements', groupement.id, 'challenges')
            );

            challengesSnap.docs.forEach((challengeDoc) => {
                const challenge = challengeDoc.data();
                if (challenge.presetId === presetId) {
                    results.push({
                        groupId: group.id,
                        groupName: group.name,
                        groupementId: groupement.id,
                        groupementName: groupement.name,
                        challengeId: challengeDoc.id,
                        challengeLabel: challenge.label,
                        unit: challenge.unit,
                        periodKey: current.periodKey,
                    });
                }
            });
        }
    }

    return results;
}