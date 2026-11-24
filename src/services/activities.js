import { collection, doc, getDocFromServer, increment, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentPeriod } from './groupements';

export function createActivityId(uid) {
  return doc(collection(db, 'users', uid, 'activities')).id;
}

// Une seule transaction : aucun historique n'est marqué comme importé avant
// que toutes les contributions aient été enregistrées. L'identifiant doit être
// conservé par l'appelant après une erreur réseau ou une réponse perdue.
export async function saveActivity({
  uid,
  userName,
  activityId,
  presetId,
  label,
  icon,
  unit,
  value,
  targets = [],
  date,
  externalId,
  source,
  durationMin,
}) {
  if (!uid || !activityId || activityId.includes('/')) throw new Error('Identifiant d’activité invalide.');
  if (!Number.isFinite(value) || value <= 0) throw new Error('Indique une valeur finie supérieure à 0.');
  if (externalId && externalId !== activityId) throw new Error('Identifiant d’import incohérent.');
  const unique = [
    ...new Map(
      targets.map((target) => [`${target.groupId}/${target.groupementId}/${target.challengeId}`, target])
    ).values(),
  ];
  // Marge sur le nombre d'écritures et sur les accès des règles aux groupes.
  // Ne jamais découper silencieusement : cela réintroduirait les échecs partiels.
  if (unique.length > 100 || new Set(unique.map((target) => target.groupId)).size > 8) {
    throw new Error('Trop de challenges ou de groupes sélectionnés. Réduis la sélection ; rien n’a été enregistré.');
  }
  const activityRef = doc(db, 'users', uid, 'activities', activityId);
  try {
    return await runTransaction(db, async (transaction) => {
      if ((await transaction.get(activityRef)).exists()) return false;
      const loaded = [];
      for (const target of unique) {
        const eventRef = doc(db, 'groups', target.groupId, 'groupements', target.groupementId);
        const challengeRef = doc(eventRef, 'challenges', target.challengeId);
        const event = await transaction.get(eventRef);
        const challenge = await transaction.get(challengeRef);
        if (!event.exists() || !challenge.exists())
          throw new Error('Un événement ou challenge a été supprimé. Actualise la sélection.');
        loaded.push({ target, event: event.data(), challenge: challenge.data(), challengeRef });
      }
      // Recalcul après les lectures et à chaque nouvelle tentative de transaction.
      const now = new Date();
      const activityDate = date ? new Date(date) : now;
      if (!Number.isFinite(activityDate.getTime()) || activityDate > now) throw new Error('Date d’activité invalide.');
      for (const { target, event, challenge } of loaded) {
        const current = getCurrentPeriod(event, now);
        if (
          !current ||
          current.notStarted ||
          current.periodKey !== target.periodKey ||
          !(now < current.periodEnd) ||
          !(activityDate >= current.periodStart && activityDate < current.periodEnd)
        ) {
          throw new Error(
            'La période a changé ou est terminée. Reviens à l’écran précédent et actualise les challenges avant de réessayer.'
          );
        }
        if (presetId && (challenge.presetId !== presetId || challenge.unit !== unit)) {
          throw new Error('Un challenge a changé de type ou d’unité. Actualise la sélection.');
        }
      }
      // Pour une saisie depuis un challenge, ses métadonnées viennent de la lecture transactionnelle.
      const metadata = presetId ? { presetId, label, icon, unit } : loaded[0]?.challenge;
      if (!metadata || !['presetId', 'label', 'icon', 'unit'].every((key) => typeof metadata[key] === 'string')) {
        throw new Error('Type d’activité invalide.');
      }
      const first = unique.length === 1 ? unique[0] : {};
      const data = {
        presetId: metadata.presetId,
        label: metadata.label,
        icon: metadata.icon,
        unit: metadata.unit,
        value,
        groupId: first.groupId || null,
        groupementId: first.groupementId || null,
        challengeId: first.challengeId || null,
        createdAt: activityDate,
        targets: unique.map(({ groupId, groupementId, challengeId, periodKey }) => ({
          groupId,
          groupementId,
          challengeId,
          periodKey,
        })),
      };
      if (externalId)
        Object.assign(data, { imported: true, externalId, source: source ?? null, durationMin: durationMin ?? null });
      transaction.set(activityRef, data);
      const statsKey = metadata.presetId === 'custom' ? first.challengeId || metadata.label : metadata.presetId;
      transaction.set(
        doc(db, 'users', uid, 'stats', statsKey),
        {
          icon: metadata.icon,
          label: metadata.label,
          unit: metadata.unit,
          total: increment(value),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      for (const { target, challengeRef } of loaded) {
        transaction.set(doc(challengeRef, 'periods', target.periodKey, 'activities', `${uid}_${activityId}`), {
          userId: uid,
          userName,
          value,
          createdAt: activityDate,
        });
        const progress = { name: userName, value: increment(value), updatedAt: serverTimestamp() };
        transaction.set(doc(challengeRef, 'periods', target.periodKey, 'progress', uid), progress, { merge: true });
        transaction.set(doc(challengeRef, 'cumulative', uid), progress, { merge: true });
      }
      return true;
    });
  } catch (error) {
    // En concurrence, les règles « création seule » du journal peuvent refuser
    // le second commit avant le retry du SDK. Une réponse réseau perdue peut
    // aussi masquer un succès. Seule une lecture serveur confirme ce succès.
    try {
      if ((await getDocFromServer(activityRef)).exists()) return false;
    } catch {
      // Si le serveur reste inaccessible, conserver l'erreur et le même ID.
    }
    throw error;
  }
}
