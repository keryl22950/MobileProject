import { useEffect, useState } from 'react';
import { subscribeToChallenges, subscribeToProgress } from '../services/challenges';
import { getCurrentPeriod } from '../services/groupements';

export function useGroupementFill(groupId, groupementId, groupement) {
    const [challenges, setChallenges] = useState([]);
    const [fills, setFills] = useState({});

    useEffect(() => {
        const unsubscribe = subscribeToChallenges(groupId, groupementId, setChallenges);
        return unsubscribe;
    }, [groupId, groupementId]);

    useEffect(() => {
        if (!groupement) return;
        const period = getCurrentPeriod(groupement);
        if (!period || period.notStarted) return;

        const unsubs = challenges.map((c) =>
            subscribeToProgress(groupId, groupementId, c.id, period.periodKey, (rows) => {
                const sum = rows.reduce((acc, r) => acc + (r.value || 0), 0);
                const pct = c.target ? Math.min(100, Math.round((sum / c.target) * 100)) : 0;
                setFills((prev) => ({ ...prev, [c.id]: { pct, sum, target: c.target, unit: c.unit } }));
            })
        );
        return () => unsubs.forEach((u) => u());
    }, [challenges, groupement, groupId, groupementId]);

    const overallPct = challenges.length
        ? Math.round(challenges.reduce((acc, c) => acc + (fills[c.id]?.pct || 0), 0) / challenges.length)
        : 0;

    return { challenges, fills, overallPct };
}