import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// Règle d'ajustement : atteint → +step %, sinon → -step %. Modifie ici si tu veux une autre règle.
export function computeNextTarget(prevTarget, prevTotal, stepPercent) {
    const factor = prevTotal >= prevTarget ? 1 + stepPercent / 100 : 1 - stepPercent / 100;
    const next = Math.max(1, prevTarget * factor);
    return next >= 20 ? Math.round(next) : Math.round(next * 10) / 10;
}

function periodDoc(groupId, groupementId, challengeId, periodKey) {
    return doc(db, 'groups', groupId, 'groupements', groupementId, 'challenges', challengeId, 'periods', periodKey);
}

async function periodTotal(groupId, groupementId, challengeId, periodKey) {
    const snap = await getDocs(
        collection(db, 'groups', groupId, 'groupements', groupementId, 'challenges', challengeId, 'periods', periodKey, 'progress')
    );
    return snap.docs.reduce((acc, d) => acc + (d.data().value || 0), 0);
}

// Écriture en "création seule" : si un autre appareil a écrit juste avant nous,
// la règle refuse la 2e écriture et on relit simplement la valeur déjà enregistrée.
async function writeOrRead(ref, target) {
    try {
        await setDoc(ref, { target, createdAt: serverTimestamp() });
        return target;
    } catch (err) {
        const snap = await getDoc(ref);
        if (snap.exists()) return snap.data().target;
        throw err;
    }
}

async function targetForPeriod({ groupId, groupementId, challengeId, baseTarget, step, index }) {
    const ref = periodDoc(groupId, groupementId, challengeId, `P${index}`);
    const snap = await getDoc(ref);
    if (snap.exists() && typeof snap.data().target === 'number') return snap.data().target;

    if (index === 0) return writeOrRead(ref, baseTarget);

    const prevTarget = await targetForPeriod({ groupId, groupementId, challengeId, baseTarget, step, index: index - 1 });
    const prevTotal = await periodTotal(groupId, groupementId, challengeId, `P${index - 1}`);
    return writeOrRead(ref, computeNextTarget(prevTarget, prevTotal, step));
}

// Objectif réellement applicable à une période. Pour un événement non dynamique,
// c'est simplement l'objectif du challenge (aucune lecture Firestore).
export async function getEffectiveTarget({ groupId, groupementId, groupement, challenge, periodKey }) {
    if (!groupement?.dynamicTarget) return challenge.target;
    return targetForPeriod({
        groupId,
        groupementId,
        challengeId: challenge.id,
        baseTarget: challenge.target,
        step: groupement.adaptStep ?? 10,
        index: Number(periodKey.slice(1)),
    });
}