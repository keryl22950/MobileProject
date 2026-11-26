import { distanceKm } from '../utils/geo';

export function appendLocations(track, locations) {
  const points = [...track.points];
  let total = track.distance;
  let latest = points.at(-1);
  for (const location of [...locations].sort((a, b) => a.timestamp - b.timestamp)) {
    const { latitude, longitude, accuracy } = location.coords;
    const timestamp = location.timestamp;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(timestamp)) continue;
    if ((accuracy != null && accuracy > 20) || (latest && timestamp <= latest.timestamp)) continue;
    const point = { latitude, longitude, timestamp };
    if (latest) total += distanceKm(latest, point);
    points.push(point);
    latest = point;
  }
  if (points.length <= 1600) return { ...track, points, distance: total };
  // La distance est conservée intégralement. Seul le tracé affiché est simplifié.
  const reduced = points.filter((_, index) => index % 2 === 0 || index === points.length - 1);
  return { ...track, points: reduced, distance: total };
}
