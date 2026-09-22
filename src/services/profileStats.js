import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from './firebase';

export async function computeUserStats(uid) {
    const groupsSnap = await getDocs(query(collection(db, 'groups'), where('memberIds', 'array-contains', uid)));
    const totalsByKey = {};
    let groupsCount = 0;

    for (const groupDoc of groupsSnap.docs) {
        groupsCount += 1;
        const groupementsSnap = await getDocs(collection(db, 'groups', groupDoc.id, 'groupements'));

        for (const groupementDoc of groupementsSnap.docs) {
            const challengesSnap = await getDocs(
                collection(db, 'groups', groupDoc.id, 'groupements', groupementDoc.id, 'challenges')
            );

            for (const challengeDoc of challengesSnap.docs) {
                const challenge = challengeDoc.data();
                const cumulativeRef = doc(db, 'groups', groupDoc.id, 'groupements', groupementDoc.id, 'challenges', challengeDoc.id, 'cumulative', uid);
                const cumulativeSnap = await getDoc(cumulativeRef);
                if (!cumulativeSnap.exists()) continue;
                const value = cumulativeSnap.data().value || 0;
                if (value <= 0) continue;

                const key = challenge.presetId === 'custom' ? challenge.label : challenge.presetId;
                if (!totalsByKey[key]) {
                    totalsByKey[key] = { icon: challenge.icon, label: challenge.label, unit: challenge.unit, total: 0 };
                }
                totalsByKey[key].total += value;
            }
        }
    }

    return { groupsCount, totals: Object.values(totalsByKey) };
}