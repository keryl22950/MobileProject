import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { appendLocations } from './gpsTrack';

const task = 'challengeapp-gps';
const key = 'gps-route-in-progress';
let operations = Promise.resolve();
let nextSession = 0;
let receiver;

function serialized(operation) {
  const result = operations.then(operation);
  operations = result.catch(() => {});
  return result;
}

async function readTrack() {
  const saved = await AsyncStorage.getItem(key);
  return saved ? JSON.parse(saved) : null;
}

TaskManager.defineTask(task, ({ data, error }) =>
  serialized(async () => {
    const track = await readTrack();
    if (!track) return;
    if (error) {
      if (receiver?.id === track.id) receiver.onError(error);
      return;
    }
    if (!data?.locations?.length) return;
    const updated = appendLocations(track, data.locations);
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    if (receiver?.id === track.id) receiver.onTrack(updated);
  })
);

export function startBackgroundGps(onTrack, onError) {
  const id = Date.now() + '-' + ++nextSession;
  let stopped = false;
  let stateSubscription;

  const ready = (async () => {
    if (!(await TaskManager.isAvailableAsync())) throw new Error('Ce build ne permet pas le suivi en arrière-plan.');
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (stopped) return;
    if (foreground.status !== 'granted') throw new Error('Autorise l’accès à la position pour démarrer le suivi.');
    const background = await Location.requestBackgroundPermissionsAsync();
    if (stopped) return;
    if (background.status !== 'granted')
      throw new Error('Autorise le suivi en arrière-plan ou choisis le suivi classique.');
    await serialized(async () => {
      if (stopped) return;
      if (await Location.hasStartedLocationUpdatesAsync(task)) await Location.stopLocationUpdatesAsync(task);
      if (stopped) return;
      receiver = { id, onTrack, onError };
      await AsyncStorage.setItem(key, JSON.stringify({ id, points: [], distance: 0 }));
      await Location.startLocationUpdatesAsync(task, {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 5,
        timeInterval: 2000,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Suivi GPS en cours',
          notificationBody: 'Ouvre ChallengeApp pour arrêter l’enregistrement du parcours.',
          killServiceOnDestroy: true,
        },
      });
      if (!stopped) {
        stateSubscription = AppState.addEventListener('change', (state) => {
          if (state !== 'active') return;
          readTrack()
            .then((track) => {
              if (!stopped && track?.id === id) onTrack(track);
            })
            .catch(onError);
        });
      }
    });
  })();

  return {
    ready,
    stop: () => {
      if (stopped) return;
      stopped = true;
      stateSubscription?.remove();
      serialized(async () => {
        if (receiver?.id === id) receiver = undefined;
        if ((await readTrack())?.id !== id) return;
        try {
          if (await Location.hasStartedLocationUpdatesAsync(task)) await Location.stopLocationUpdatesAsync(task);
        } finally {
          await AsyncStorage.removeItem(key);
        }
      }).catch(onError);
    },
  };
}
