import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { distanceKm } from '../utils/geo';

let sessionId = 0;

export function startForegroundGps(onDistance, onError) {
  const tag = 'gps-' + ++sessionId;
  let stopped = false;
  let awake = false;
  let subscription;
  let previous;
  let total = 0;

  function releaseDisplay() {
    if (!awake) return;
    awake = false;
    deactivateKeepAwake(tag).catch(() => {});
  }

  function stop() {
    stopped = true;
    try {
      subscription?.remove();
    } finally {
      subscription = undefined;
      releaseDisplay();
    }
  }

  const ready = (async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (stopped) return;
      if (status !== 'granted') throw new Error('Autorise l’accès à la position pour démarrer le suivi GPS.');
      await activateKeepAwakeAsync(tag);
      awake = true;
      if (stopped) {
        releaseDisplay();
        return;
      }
      const watch = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 2000 },
        ({ coords }) => {
          if (stopped || (coords.accuracy != null && coords.accuracy > 20)) return;
          if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) return;
          if (previous) total += distanceKm(previous, coords);
          previous = coords;
          onDistance(total);
        },
        (reason) => {
          if (stopped) return;
          stop();
          onError(new Error(reason));
        }
      );
      if (stopped) watch.remove();
      else subscription = watch;
    } catch (error) {
      if (stopped) return;
      stop();
      throw error;
    }
  })();

  return { ready, stop };
}
