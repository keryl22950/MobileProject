import React, { useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { colors, spacing } from '../theme';

export default function RouteMap({ points }) {
  const map = useRef(null);
  const coordinates = useMemo(() => points.map(({ latitude, longitude }) => ({ latitude, longitude })), [points]);
  if (coordinates.length < 2) return null;
  if (Platform.OS === 'android' && !process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return <RouteOutline coordinates={coordinates} />;
  }
  return (
    <MapView
      ref={map}
      style={styles.map}
      accessibilityLabel="Carte de ton parcours"
      initialRegion={{ ...coordinates[0], latitudeDelta: 0.01, longitudeDelta: 0.01 }}
      onMapReady={() =>
        map.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 24, left: 24, right: 24, bottom: 24 },
          animated: false,
        })
      }
    >
      <Polyline coordinates={coordinates} strokeColor={colors.primary} strokeWidth={4} />
    </MapView>
  );
}

function RouteOutline({ coordinates }) {
  const lats = coordinates.map((p) => p.latitude);
  const lons = coordinates.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const minLon = Math.min(...lons);
  const latSpan = Math.max(...lats) - minLat;
  const lonSpan = Math.max(...lons) - minLon;
  const scale = 140 / Math.max(latSpan, lonSpan, 0.00001);
  const stride = Math.ceil(coordinates.length / 120);
  const points = coordinates
    .filter((_, i) => i % stride === 0 || i === coordinates.length - 1)
    .map((point) => ({
      x: 20 + (point.longitude - minLon) * scale,
      y: 20 + (minLat + latSpan - point.latitude) * scale,
    }));
  return (
    <View style={{ alignItems: 'center' }} accessible accessibilityLabel="Tracé de ton parcours sans fond de carte">
      <View style={styles.outline}>
        {points.slice(1).map((end, index) => {
          const start = points[index];
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const width = Math.hypot(dx, dy);
          return (
            <View
              key={index}
              style={{
                position: 'absolute',
                height: 2,
                left: (start.x + end.x - width) / 2,
                top: (start.y + end.y) / 2,
                width,
                backgroundColor: colors.primary,
                transform: [{ rotate: Math.atan2(dy, dx) + 'rad' }],
              }}
            />
          );
        })}
      </View>
      <Text style={styles.caption}>Tracé du parcours</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', height: 200, borderRadius: 12 },
  outline: { width: 180, height: 180, backgroundColor: colors.background, borderRadius: 12 },
  caption: { color: colors.muted, marginTop: spacing.sm },
});
