import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveActivity } from './activities';

const prefix = (uid) => `pending-activity:v1:${encodeURIComponent(uid)}:`;
const keyFor = (uid, id) => `${prefix(uid)}${encodeURIComponent(id)}`;
const running = new Map();

export async function listPendingActivities(uid) {
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(prefix(uid)));
  const records = await AsyncStorage.multiGet(keys);
  return records.filter(([, value]) => value !== null).map(([, value]) => JSON.parse(value));
}

// Écrire sur disque AVANT le réseau. Une reprise conserve exactement la date,
// les cibles et la valeur initiales, même après redémarrage ou modification du formulaire.
export function savePendingActivity(args) {
  if (!args.uid || !args.activityId || !Number.isFinite(args.value) || args.value <= 0) {
    return Promise.reject(new Error('Activité invalide.'));
  }
  const key = keyFor(args.uid, args.activityId);
  if (running.has(key)) return running.get(key);
  const task = (async () => {
    const stored = await AsyncStorage.getItem(key);
    const request = stored ? JSON.parse(stored) : { ...args, date: args.date || new Date().toISOString() };
    if (!stored) await AsyncStorage.setItem(key, JSON.stringify(request));
    try {
      const added = await saveActivity(request);
      await AsyncStorage.removeItem(key);
      return added;
    } catch (error) {
      throw new Error(
        `${error.message}\nLa tentative initiale est conservée dans « Activités à reprendre » sur l’accueil.`
      );
    }
  })();
  running.set(key, task);
  const clear = () => running.delete(key);
  task.then(clear, clear);
  return task;
}

export async function discardPendingActivity(uid, activityId) {
  const key = keyFor(uid, activityId);
  if (running.has(key)) throw new Error('Attends la fin de la tentative avant de retirer cette activité.');
  await AsyncStorage.removeItem(key);
}
