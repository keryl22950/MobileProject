import { useEffect, useState } from 'react';
import { subscribeToChallenges, subscribeToProgress } from '../services/challenges';
import { getCurrentPeriod } from '../services/groupements';
import { getEffectiveTarget } from '../services/dynamicTargets';

export function useGroupementFill(groupId, groupementId, groupement) {
    const [challenges, setChallenges] = useState([]);
    const [fills, setFills] = useState({});

    useEffect(() => subscribeToChallenges(groupId, groupementId, setChallenges), [groupId, groupementId]);

    useEffect(() => {
        if (!groupement) return;
        const period = getCurrentPeriod(groupement);
        if (!period || period.notStarted) return;

        let cancelled = false;
        const unsubs = [];

        challenges.forEach(async (c) => {
            let target = c.target;
            try {
                target = await getEffectiveTarget({ groupId, groupementId, groupement, challenge: c, periodKey: period.periodKey });
            } catch (err) {
                // en cas d'échec on retombe sur l'objectif de base
            }
            if (cancelled) return;

            const unsub = subscribeToProgress(groupId, groupementId, c.id, period.periodKey, (rows) => {
                const sum = rows.reduce((acc, r) => acc + (r.value || 0), 0);
                const pct = target ? Math.min(100, Math.round((sum / target) * 100)) : 0;
                setFills((prev) => ({ ...prev, [c.id]: { pct, sum, target, unit: c.unit } }));
            });
            if (cancelled) unsub();
            else unsubs.push(unsub);
        });

        return () => {
            cancelled = true;
            unsubs.forEach((u) => u());
        };
    }, [challenges, groupement, groupId, groupementId]);

    const overallPct = challenges.length
        ? Math.round(challenges.reduce((acc, c) => acc + (fills[c.id]?.pct || 0), 0) / challenges.length)
        : 0;

    return { challenges, fills, overallPct };
}