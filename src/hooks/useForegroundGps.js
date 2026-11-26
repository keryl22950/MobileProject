import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { startForegroundGps } from '../services/foregroundGps';

export function useForegroundGps() {
  const session = useRef(null);
  const [trackedDistance, setTrackedDistance] = useState(0);
  const [status, setStatus] = useState('idle');

  const stopTracking = useCallback(() => {
    session.current?.stop();
    session.current = null;
    setStatus('idle');
  }, []);

  useFocusEffect(useCallback(() => stopTracking, [stopTracking]));

  async function startTracking() {
    if (session.current) return;
    setStatus('starting');
    setTrackedDistance(0);
    const onError = (error) => {
      if (session.current !== next) return;
      stopTracking();
      Alert.alert('Suivi GPS indisponible', error.message);
    };
    const next = startForegroundGps(setTrackedDistance, onError);
    session.current = next;
    try {
      await next.ready;
      if (session.current === next) setStatus('tracking');
    } catch (error) {
      onError(error);
    }
  }

  return {
    startTracking,
    stopTracking,
    trackedDistance,
    isTracking: status === 'tracking',
    starting: status === 'starting',
  };
}
