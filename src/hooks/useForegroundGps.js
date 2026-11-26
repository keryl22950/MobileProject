import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { startForegroundGps } from '../services/foregroundGps';
import { startBackgroundGps } from '../services/backgroundGps';

export function useForegroundGps() {
  const session = useRef(null);
  const [trackedDistance, setTrackedDistance] = useState(0);
  const [routePoints, setRoutePoints] = useState([]);
  const [status, setStatus] = useState('idle');

  const stopTracking = useCallback(() => {
    session.current?.stop();
    session.current = null;
    setStatus('idle');
  }, []);

  useFocusEffect(useCallback(() => stopTracking, [stopTracking]));

  async function startTracking(background = false) {
    if (session.current) return;
    setStatus('starting');
    setTrackedDistance(0);
    setRoutePoints([]);
    const onError = (error) => {
      if (session.current !== next) return;
      stopTracking();
      Alert.alert('Suivi GPS indisponible', error.message);
    };
    const next = background
      ? startBackgroundGps(({ points, distance }) => {
          setTrackedDistance(distance);
          setRoutePoints(points);
        }, onError)
      : startForegroundGps((distance, point) => {
          setTrackedDistance(distance);
          setRoutePoints((points) => {
            const sampled = points.length >= 1600 ? points.filter((_, index) => index % 2 === 0) : points;
            return [...sampled, point];
          });
        }, onError);
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
    routePoints,
    isTracking: status === 'tracking',
    starting: status === 'starting',
  };
}
