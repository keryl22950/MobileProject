import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentPeriod } from './groupements';

// Parcourt tous les groupes de l'utilisateur pour trouver les challenges
// actifs correspondant à un type d'activité donné (presetId).
export async function findActiveChallengesForPreset({ uid, presetId }) {
    const groupsSnap = await getDocs(query(collection(db, 'groups'), where('memberIds', 'array-contains', uid)));
    const results = [];

    for (const groupDoc of groupsSnap.docs) {
        const group = { id: groupDoc.id, ...groupDoc.data() };
        const groupementsSnap = await getDocs(collection(db, 'groups', group.id, 'groupements'));

        for (const groupementDoc of groupementsSnap.docs) {
            const groupement = { id: groupementDoc.id, ...groupementDoc.data() };
            const period = getCurrentPeriod(groupement);
            if (!period || period.notStarted) continue;
            if (!groupement.recurring && period.periodEnd.getTime() < Date.now()) continue;

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
                        periodKey: period.periodKey,
                    });
                }
            });
        }
    }

    return results;
}